import { describe, expect, it } from "vitest";

import {
  AUTOMATION_RUN_STALE_MS,
  canExecuteAutomations,
  canReclaimAutomationRun,
} from "../eligibility";

describe("canExecuteAutomations", () => {
  it("allows only active Pro subscriptions", () => {
    expect(canExecuteAutomations({ status: "active", tier: "pro" })).toBe(true);
    expect(canExecuteAutomations({ status: "trialing", tier: "pro" })).toBe(true);
  });

  it("blocks lower tiers and inactive subscriptions", () => {
    expect(canExecuteAutomations({ status: "active", tier: "growth" })).toBe(false);
    expect(canExecuteAutomations({ status: "past_due", tier: "pro" })).toBe(false);
    expect(canExecuteAutomations({ status: "canceled", tier: "pro" })).toBe(false);
    expect(canExecuteAutomations(null)).toBe(false);
  });
});

describe("canReclaimAutomationRun", () => {
  const now = Date.parse("2026-09-19T02:30:00.000Z");

  it("retries failed runs immediately", () => {
    expect(
      canReclaimAutomationRun(
        { status: "failed", started_at: "2026-09-19T02:29:59.000Z" },
        now,
      ),
    ).toBe(true);
  });

  it("does not reclaim an active running lease", () => {
    expect(
      canReclaimAutomationRun(
        { status: "running", started_at: new Date(now - AUTOMATION_RUN_STALE_MS + 1).toISOString() },
        now,
      ),
    ).toBe(false);
  });

  it("reclaims a running lease once the job reaper window has elapsed", () => {
    expect(
      canReclaimAutomationRun(
        { status: "running", started_at: new Date(now - AUTOMATION_RUN_STALE_MS).toISOString() },
        now,
      ),
    ).toBe(true);
  });

  it("never reclaims terminal or malformed leases", () => {
    expect(canReclaimAutomationRun({ status: "succeeded", started_at: null }, now)).toBe(false);
    expect(canReclaimAutomationRun({ status: "skipped", started_at: null }, now)).toBe(false);
    expect(canReclaimAutomationRun({ status: "running", started_at: "invalid" }, now)).toBe(false);
  });
});
