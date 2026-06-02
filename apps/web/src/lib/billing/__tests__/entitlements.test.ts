import { describe, expect, it } from "vitest";

import { entitlementFor, type SubscriptionSnapshot } from "../entitlements";

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
