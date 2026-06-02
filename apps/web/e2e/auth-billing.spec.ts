import { test, expect } from "@playwright/test";

import * as db from "./helpers/supabase";

/**
 * Day 22 — the auth + billing "spine".
 *
 * One ordered browser story that proves Days 9–21 compose end to end:
 *   signup → confirm → login → onboarding → invite → accept (auto-join)
 *   → product pages gated → subscribe surface loads → active un-gates
 *   → cancel re-gates (revoked).
 *
 * Stripe is exercised deterministically: we assert the embedded Checkout surface
 * LOADS, but drive the subscription state through the service-role seeder
 * (helpers/supabase `setSubscription`) — the same row the Day-18 webhook writes —
 * so the Day-19 gate flips without the flaky Checkout iframe. Runs against the
 * dedicated TEST Supabase project; self-cleaning in afterAll.
 */

const RUN = Date.now().toString(36);
const ownerEmail = db.emailFor(RUN, "owner");
const inviteeEmail = db.emailFor(RUN, "invitee");

let ownerId = "";
let inviteeId = "";
let ownerOrgId = "";

test.afterAll(async () => {
  await db.cleanup([ownerId, inviteeId]);
});

test("auth + billing spine", async ({ page, browser }) => {
  await test.step("the signup form renders and validates", async () => {
    // We exercise the signup surface + its server action here, but do NOT create
    // the account through public signup: GoTrue's email validation is a
    // per-project toggle (the test project rejects the reserved .test domain that
    // prod accepts), and confirmation email delivery is out of scope. Submitting
    // empty drives the zod path in the action and surfaces a field error — proof
    // the form is wired — without touching GoTrue. The funnel below runs on an
    // admin-seeded confirmed owner (admin.createUser bypasses that validation,
    // exactly as the Vitest harnesses do).
    await page.goto("/signup");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Enter your name.")).toBeVisible();
  });

  await test.step("a confirmed owner can sign in", async () => {
    ownerId = await db.createConfirmedUser(ownerEmail);
    ownerOrgId = await db.ownOrgId(ownerId);

    await page.goto("/login");
    await page.getByLabel("Email").fill(ownerEmail);
    await page.getByLabel("Password").fill(db.E2E_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    // The auto-provisioned org is un-onboarded → routed to the wizard.
    await expect(page).toHaveURL(/\/onboarding/);
  });

  await test.step("completing onboarding routes to billing", async () => {
    await page.getByLabel("Business name").fill("Acme E2E Inc");

    await page.locator("#industry").click();
    await page.getByRole("option", { name: "Technology" }).click();

    await page.locator("#size").click();
    await page.getByRole("option", { name: "Just me" }).click();

    await page.getByRole("button", { name: "Continue to dashboard" }).click();
    await expect(page).toHaveURL(/\/billing/);
  });

  let token = "";
  await test.step("owner invites a teammate", async () => {
    // Seed the invitee as a confirmed user so they can sign in to accept.
    inviteeId = await db.createConfirmedUser(inviteeEmail);

    await page.goto("/settings/team");
    await page.getByLabel("Email").fill(inviteeEmail);
    await page.getByRole("button", { name: "Send invite" }).click();

    // The invite row exists once the action completes (email send may fail with
    // a dummy Resend key in CI — the invite is still created). Poll the token.
    await expect
      .poll(
        async () => {
          try {
            token = await db.inviteTokenFor(ownerOrgId, inviteeEmail);
            return Boolean(token);
          } catch {
            return false;
          }
        },
        { timeout: 10_000 },
      )
      .toBe(true);
  });

  await test.step("invitee accepts and auto-joins the org", async () => {
    const ctx = await browser.newContext();
    const invitee = await ctx.newPage();

    await invitee.goto("/login");
    await invitee.getByLabel("Email").fill(inviteeEmail);
    await invitee.getByLabel("Password").fill(db.E2E_PASSWORD);
    await invitee.getByRole("button", { name: "Sign in" }).click();
    await invitee.waitForURL(/\/(onboarding|dashboard|billing)/);

    // The accept page lives outside the (app) gate; redeems the token and routes on.
    await invitee.goto(`/invite/accept?token=${encodeURIComponent(token)}`);
    await invitee.waitForURL(/\/(dashboard|billing|onboarding)/);
    await ctx.close();

    expect(await db.isMember(ownerOrgId, inviteeId)).toBe(true);
  });

  await test.step("product pages are gated before subscribing", async () => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/billing/);
    await expect(page.getByRole("heading", { name: "Choose your plan" })).toBeVisible();
  });

  await test.step("the subscribe surface loads", async () => {
    await page.goto("/billing/subscribe?plan=growth");
    await expect(
      page.getByRole("heading", { name: /Subscribe to Growth/ }),
    ).toBeVisible();
    // The embedded Checkout container mounts (the Stripe iframe loads inside it).
    await expect(page.locator("#checkout")).toBeAttached();
  });

  await test.step("an active subscription un-gates the product pages", async () => {
    await db.setSubscription(ownerOrgId, "active");
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible();
  });

  await test.step("cancelling revokes access again", async () => {
    await db.setSubscription(ownerOrgId, "canceled");
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/billing/);
  });
});
