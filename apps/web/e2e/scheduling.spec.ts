import { test, expect } from "@playwright/test";

import * as db from "./helpers/supabase";
import * as sched from "./helpers/scheduling";

/**
 * Day 63 — the AI Workforce Scheduling "spine" (Phase 3 buffer, closes Milestone 3).
 *
 * Mirrors the Day-22 auth+billing and Day-36 assistant spines: seed the exact
 * ground truth the real flows persist (service-role), then drive the UI and
 * assert the surfaces mount. The DeepSeek-dependent generation has a deterministic
 * fallback and is covered by the Vitest db tests (Days 46–57); the manual
 * disruption scenarios (sick-call → replacement → swap → time-off) likewise have
 * their own live db harnesses. This spine proves the manager + employee-portal
 * happy path renders end to end against seeded data — and that the Day-61 plan
 * gate actually gates.
 *
 * Walks the launch story: an onboarded, Growth-subscribed manager has a published
 * schedule + roster → the calendar / team / analytics / activity surfaces render →
 * an employee opens their portal magic link and sees their shift. Then a Starter
 * downgrade hits the scheduling upgrade gate.
 *
 * Runs against the dedicated TEST Supabase project; self-cleaning in afterAll.
 */

const RUN = Date.now().toString(36);
const ownerEmail = db.emailFor(RUN, "sched-owner");
const EMP1 = `Avery Stone ${RUN}`;
const EMP2 = `Blake Rivers ${RUN}`;

let ownerId = "";
let orgId = "";
let portalToken = "";

test.afterAll(async () => {
  await db.cleanup([ownerId]);
});

test("scheduling spine", async ({ page }) => {
  await test.step("seed an onboarded, Growth-subscribed manager with a published schedule", async () => {
    ownerId = await db.createConfirmedUser(ownerEmail);
    orgId = await db.ownOrgId(ownerId);
    await db.onboardOrg(orgId);
    // Scheduling is a Growth+ feature (Day 61) — Growth opens the gate.
    await db.setSubscription(orgId, "active", "growth");
    await sched.completeSchedulingOnboarding(orgId);

    const emp1 = await sched.seedEmployee(orgId, EMP1, db.emailFor(RUN, "emp1"));
    const emp2 = await sched.seedEmployee(orgId, EMP2, db.emailFor(RUN, "emp2"));
    await sched.seedRole(orgId, `Barista ${RUN}`);
    await sched.seedWholeWeekAvailability(orgId, emp1);
    await sched.seedPublishedSchedule(orgId, [emp1, emp2]);
    portalToken = await sched.seedPortalToken(orgId, emp1);

    await page.goto("/login");
    await page.getByLabel("Email").fill(ownerEmail);
    await page.getByLabel("Password").fill(db.E2E_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/(dashboard|scheduling|assistant|knowledge)/);
  });

  await test.step("the scheduling home shows the onboarded workspace (no setup bounce)", async () => {
    await page.goto("/scheduling");
    // Onboarded → the summary, not a redirect to /scheduling/setup.
    await expect(page).toHaveURL(/\/scheduling$/);
    await expect(page.getByText("Team members")).toBeVisible();
  });

  await test.step("the team roster lists the seeded employees", async () => {
    await page.goto("/scheduling/employees");
    await expect(page.getByRole("heading", { name: "Team" })).toBeVisible();
    await expect(page.getByText(EMP1)).toBeVisible();
    await expect(page.getByText(EMP2)).toBeVisible();
  });

  await test.step("the calendar renders the published schedule", async () => {
    await page.goto("/scheduling/calendar");
    await expect(page.getByRole("heading", { name: "Schedule" })).toBeVisible();
  });

  await test.step("the analytics dashboard renders", async () => {
    await page.goto("/scheduling/analytics");
    await expect(page.getByText("Labor utilization")).toBeVisible();
    await expect(page.getByText("People scheduled")).toBeVisible();
  });

  await test.step("the activity log renders for the manager", async () => {
    await page.goto("/scheduling/activity");
    await expect(page.getByRole("heading", { name: "Activity log" })).toBeVisible();
  });

  await test.step("the setup wizard reopens prefilled for editing (no redirect bounce)", async () => {
    await page.goto("/scheduling/setup");
    // Onboarded orgs used to be redirected straight back to /scheduling; the wizard
    // must now stay open so settings are editable.
    await expect(page).toHaveURL(/\/scheduling\/setup$/);
    await expect(page.getByRole("heading", { name: "Edit scheduling setup" })).toBeVisible();
    // ...and the roster step is prefilled with the seeded team (it used to start blank).
    await expect(page.locator("#name-emp-0")).toHaveValue(EMP1);
  });

  await test.step("an employee opens their portal magic link and sees their shift", async () => {
    // /portal/enter sets the httpOnly cookie + redirects to the deep link.
    await page.goto(`/portal/enter?token=${portalToken}&next=/portal/schedule`);
    await page.waitForURL(/\/portal\/schedule/);
    await expect(page.getByRole("heading", { name: "Your schedule" })).toBeVisible();
    // The seeded published shift is in the next two weeks → not the empty state.
    await expect(page.getByText("No upcoming shifts")).toHaveCount(0);
  });

  await test.step("downgrading to Starter gates scheduling behind an upgrade prompt", async () => {
    // Day-61 feature gate: Starter doesn't include scheduling → the layout shows
    // the UpgradeGate instead of the product (and never a dead-end redirect).
    await db.setSubscription(orgId, "active", "starter");
    await page.goto("/scheduling");
    await expect(page.getByText("Scheduling is a Growth feature")).toBeVisible();
    await expect(page.getByRole("link", { name: "Upgrade plan" })).toBeVisible();
  });
});
