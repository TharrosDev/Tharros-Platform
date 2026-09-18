import { describe, expect, it } from "vitest";

import { entitlementFor, featureAccessFor, type SubscriptionSnapshot } from "../entitlements";

function sub(overrides: Partial<SubscriptionSnapshot> = {}): SubscriptionSnapshot {
  return {
    status: "active",
    tier: "growth",
    current_period_end: null,
    cancel_at_period_end: false,
    trial_ends_at: null,
    ...overrides,
  };
}

const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

describe("entitlementFor", () => {
  it("blocks when there is no subscription row", () => {
    expect(entitlementFor(null)).toEqual({ allowed: false, status: "none", banner: null });
  });

  it("allows active and healthy trial subscriptions", () => {
    expect(entitlementFor(sub({ status: "active" })).allowed).toBe(true);
    expect(entitlementFor(sub({ status: "trialing", trial_ends_at: daysFromNow(10) })).allowed).toBe(
      true,
    );
  });

  it("shows the trial-ending banner within the threshold", () => {
    const e = entitlementFor(sub({ status: "trialing", trial_ends_at: daysFromNow(2) }));
    expect(e.banner).toBe("trial_ending");
    expect(e.trialDaysLeft).toBe(2);
  });

  it("blocks failed and terminal billing states", () => {
    expect(entitlementFor(sub({ status: "past_due" })).allowed).toBe(false);
    expect(entitlementFor(sub({ status: "unpaid" })).allowed).toBe(false);
    for (const status of ["canceled", "incomplete", "incomplete_expired", "paused"] as const) {
      expect(entitlementFor(sub({ status })).allowed).toBe(false);
    }
  });
});

describe("featureAccessFor", () => {
  it("requires an active subscription", () => {
    expect(featureAccessFor(null, "scheduling")).toEqual({
      entitled: false,
      reason: "no_subscription",
      tier: null,
    });
  });

  it("enforces the product ladder", () => {
    expect(featureAccessFor(sub({ tier: "starter" }), "assistant").entitled).toBe(true);
    expect(featureAccessFor(sub({ tier: "starter" }), "scheduling").entitled).toBe(false);
    expect(featureAccessFor(sub({ tier: "growth" }), "scheduling").entitled).toBe(true);
    expect(featureAccessFor(sub({ tier: "growth" }), "leads").entitled).toBe(true);
    expect(featureAccessFor(sub({ tier: "growth" }), "automations").entitled).toBe(false);
    expect(featureAccessFor(sub({ tier: "pro" }), "automations").entitled).toBe(true);
  });

  it("allows trialing organizations to use tier features", () => {
    expect(featureAccessFor(sub({ status: "trialing", tier: "pro" }), "automations").entitled).toBe(
      true,
    );
  });
});
