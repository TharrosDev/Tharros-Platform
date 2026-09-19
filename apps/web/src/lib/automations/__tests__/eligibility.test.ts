import { describe, expect, it } from "vitest";

import { canExecuteAutomations } from "../eligibility";

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
