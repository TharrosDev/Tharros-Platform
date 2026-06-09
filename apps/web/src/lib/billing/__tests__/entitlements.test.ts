import { describe, expect, it } from "vitest";

import { entitlementFor, featureAccessFor, type SubscriptionSnapshot } from "../entitlements";

/**
 * Day 19 — entitlement state machine. Pure: status → access + banner. The gate
 * (allowed) and the shell banner both derive from this, so the matrix here is
 * the contract. The DB read path uses member-read RLS already proven elsewhere.
 */

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

const daysFromNow = (n: number) =>
  new Date(Date.now() + n * 86_400_000).toISOString();

describe("entitlementFor", () => {
  it("blocks when there is no subscription row", () => {
    expect(entitlementFor(null)).toEqual({
      allowed: false,
      status: "none",
      banner: null,
    });
  });

  it("allows an active subscription with no banner", () => {
    const e = entitlementFor(sub({ status: "active" }));
    expect(e.allowed).toBe(true);
    expect(e.banner).toBeNull();
  });

  it("allows a trial that is not near its end, with no banner", () => {
    const e = entitlementFor(
      sub({ status: "trialing", trial_ends_at: daysFromNow(10) }),
    );
    expect(e.allowed).toBe(true);
    expect(e.banner).toBeNull();
  });

  it("shows the trial-ending banner within the threshold", () => {
    const e = entitlementFor(
      sub({ status: "trialing", trial_ends_at: daysFromNow(2) }),
    );
    expect(e.allowed).toBe(true);
    expect(e.banner).toBe("trial_ending");
    expect(e.trialDaysLeft).toBe(2);
  });

  it("blocks past_due AND surfaces the dunning banner", () => {
    const e = entitlementFor(sub({ status: "past_due" }));
    expect(e.allowed).toBe(false);
    expect(e.banner).toBe("past_due");
  });

  it("blocks unpaid with the dunning banner", () => {
    const e = entitlementFor(sub({ status: "unpaid" }));
    expect(e.allowed).toBe(false);
    expect(e.banner).toBe("past_due");
  });

  it.each(["canceled", "incomplete", "incomplete_expired", "paused"] as const)(
    "blocks %s with no banner",
    (status) => {
      const e = entitlementFor(sub({ status }));
      expect(e.allowed).toBe(false);
      expect(e.banner).toBeNull();
    },
  );
});

describe("featureAccessFor (Day 61 feature gate)", () => {
  it("denies when there is no active subscription", () => {
    expect(featureAccessFor(null, "scheduling")).toEqual({
      entitled: false,
      reason: "no_subscription",
      tier: null,
    });
    // past_due is active-ish but entitlementFor blocks it → no_subscription.
    const pastDue = featureAccessFor(sub({ status: "past_due", tier: "growth" }), "scheduling");
    expect(pastDue.entitled).toBe(false);
    expect(pastDue.reason).toBe("no_subscription");
  });

  it("denies a subscribed tier that doesn't include the feature", () => {
    const starter = featureAccessFor(sub({ status: "active", tier: "starter" }), "scheduling");
    expect(starter).toEqual({ entitled: false, reason: "not_in_plan", tier: "starter" });
  });

  it("grants a subscribed tier that includes the feature", () => {
    expect(featureAccessFor(sub({ status: "active", tier: "growth" }), "scheduling")).toEqual({
      entitled: true,
      reason: "ok",
      tier: "growth",
    });
    // A trialing Pro org still gets the feature (trial counts as allowed).
    expect(featureAccessFor(sub({ status: "trialing", tier: "pro" }), "scheduling").entitled).toBe(true);
  });

  it("grants the assistant on every paid tier", () => {
    for (const tier of ["starter", "growth", "pro"] as const) {
      expect(featureAccessFor(sub({ status: "active", tier }), "assistant").entitled).toBe(true);
    }
  });
});
