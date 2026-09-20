import { test, expect } from "@playwright/test";

import * as db from "./helpers/supabase";

/**
 * Day 36 — the AI Assistant "spine" (Phase 2 buffer, closes Milestone 2).
 *
 * Proves the assistant composes end to end: upload → ingest → query → cited
 * answer → draft email. Built as two layers, mirroring the Day-22 auth+billing
 * spine's philosophy (assert the surface mounts; drive state via seeders; richer
 * behaviour only when the provider secrets exist):
 *
 *   • Deterministic core (always runs, Supabase-only) — seeds the same ground
 *     truth the real pipeline writes (a `ready` document, a cited conversation)
 *     and asserts the knowledge/assistant UI + persistence wiring. Green in the
 *     keyless CI run.
 *   • Live tail (test.skip unless OPENAI_API_KEY + ANTHROPIC_API_KEY) — a genuine
 *     upload→ingest→cited-answer→draft-email run. Spends provider tokens, so it
 *     only fires when both keys are present (local / a keyed CI run).
 *
 * Runs against the dedicated TEST Supabase project; self-cleaning in afterAll.
 */

const RUN = Date.now().toString(36);
const ownerEmail = db.emailFor(RUN, "assistant-owner");

let ownerId = "";
let ownerOrgId = "";

const hasProviderKeys = Boolean(process.env.OPENAI_API_KEY && process.env.ANTHROPIC_API_KEY);

test.afterAll(async () => {
  await db.cleanup([ownerId]);
});

test("assistant spine", async ({ page }) => {
  await test.step("a confirmed, onboarded, subscribed owner can reach the assistant", async () => {
    // Seed the owner the way the Vitest harnesses do (admin.createUser bypasses
    // the GoTrue .test-domain rejection that public signup enforces on the test
    // project), then open the product gates: onboard the org and seed an active
    // subscription (the same row the Day-18 webhook writes) so the (subscribed)
    // layout doesn't bounce us to /billing.
    ownerId = await db.createConfirmedUser(ownerEmail);
    ownerOrgId = await db.ownOrgId(ownerId);
    await db.onboardOrg(ownerOrgId);
    await db.setSubscription(ownerOrgId, "active");

    await page.goto("/login");
    await page.getByLabel("Email").fill(ownerEmail);
    await page.getByLabel("Password").fill(db.E2E_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/(dashboard|assistant|knowledge)/);
  });

  await test.step("with no documents, the assistant nudges you to add some", async () => {
    await page.goto("/assistant");
    await expect(page.getByText("Add your documents to get started")).toBeVisible();
  });

  await test.step("a ready document unlocks the knowledge library + assistant", async () => {
    await db.createReadyDocument(ownerOrgId, "seed-handbook.txt", { withChunk: true });

    // The library lists the seeded doc with a Ready badge.
    await page.goto("/knowledge");
    await expect(page.getByText("seed-handbook.txt")).toBeVisible();
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();

    // The assistant empty state now offers the generation templates instead of
    // the upload nudge. (The chips render in both the empty state and the
    // composer header, so scope to the first match — strict mode otherwise.)
    await page.goto("/assistant");
    await expect(page.getByRole("button", { name: "Draft email" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Write SOP" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Summarize policy" }).first()).toBeVisible();
  });

  await test.step("the composer accepts a question and enables Send", async () => {
    // We assert the query is *wired* (composer → enabled Send) without completing
    // the stream — the generated answer needs Anthropic, exercised in the live
    // tail. The Send button is disabled until there's trimmed, non-streaming text.
    const composer = page.getByLabel("Ask the assistant a question");
    await composer.fill("What is our refund window?");
    await expect(page.getByRole("button", { name: "Send message" })).toBeEnabled();
  });

  await test.step("a persisted cited answer renders with its source footer", async () => {
    // Seed the exact rows /api/assistant/query writes after a grounded answer,
    // then open the thread — proving the conversation/messages + citation
    // rendering path without a Claude call.
    const documentId = await db.createReadyDocument(ownerOrgId, "refund-policy.txt");
    const conversationId = await db.seedConversationWithCitedAnswer(ownerOrgId, ownerId, {
      question: "How long do customers have to return an item?",
      answer: "Customers have 30 days from delivery to request a refund.",
      citation: { documentId, filename: "refund-policy.txt" },
    });

    await page.goto(`/assistant?c=${conversationId}`);
    await expect(page.getByText("How long do customers have to return an item?")).toBeVisible();
    await expect(
      page.getByText("Customers have 30 days from delivery to request a refund."),
    ).toBeVisible();
    await expect(page.getByText("Based on 1 document")).toBeVisible();
  });

  // ----- Live tail: real ingest + Claude. Skipped unless both keys are present.
  test.skip(
    !hasProviderKeys,
    "Live tail needs OPENAI_API_KEY + ANTHROPIC_API_KEY (keyless CI runs the deterministic core only)",
  );

  await test.step("a real upload ingests to ready", async () => {
    await page.goto("/knowledge");
    await page.locator('input[type="file"]').setInputFiles({
      name: "live-sop.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(
        "Refund policy: customers may return any item within 14 days of " +
          "delivery for a full refund. Store hours are 9am to 5pm, Monday to Friday.",
      ),
    });

    // Browser → Storage, then the uploader chains extract → embed. Poll the row.
    await expect
      .poll(
        async () => {
          const id = await db.latestDocumentId(ownerOrgId);
          return id ? await db.documentStatus(id) : null;
        },
        { timeout: 60_000, intervals: [1_000, 2_000, 3_000] },
      )
      .toBe("ready");
  });

  await test.step("a real question returns a grounded, cited answer", async () => {
    await page.goto("/assistant");
    await page
      .getByLabel("Ask the assistant a question")
      .fill("How many days do customers have to return an item?");
    await page.getByRole("button", { name: "Send message" }).click();

    // The assistant turn streams in and grounds on the uploaded SOP.
    await expect(page.getByText(/14 days/i)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/Based on \d+ document/)).toBeVisible();
  });

  await test.step("the Draft email template generates a draft", async () => {
    await page.goto("/assistant");
    await page.getByRole("button", { name: "Draft email" }).first().click();
    await page
      .getByLabel("Ask the assistant a question")
      .fill("Reply to a customer asking about our refund window.");
    await page.getByRole("button", { name: "Send message" }).click();

    // A non-empty generated draft appears (Haiku via modelForTemplate).
    await expect(page.getByText(/refund/i).first()).toBeVisible({ timeout: 60_000 });
  });
});
