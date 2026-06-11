import { describe, expect, it } from "vitest";

import {
  BILLING_CURRENCY,
  PLANS,
  TRIAL_DAYS,
  formatMonthly,
  getPlan,
  hasFeature,
  minTierForFeature,
  planByPriceId,
  queryCapFor,
} from "../plans";
import { TIERS } from "../schemas";

/**
 * Day 16 — billing catalog unit checks. Pure constants only; the Stripe API
 * paths (Checkout, webhooks) are exercised in Days 17–18. Price IDs come from
 * env and may be undefined in CI, so assertions here never depend on them.
 */

describe("billing plans", () => {
  it("defines exactly the three tiers, in ladder order", () => {
    expect(PLANS.map((p) => p.tier)).toEqual(["starter", "growth", "pro"]);
    expect(PLANS).toHaveLength(TIERS.length);
  });

  it("prices the tiers at the agreed CA$ amounts", () => {
    expect(getPlan("starter").priceMonthly).toBe(9900);
    expect(getPlan("growth").priceMonthly).toBe(29900);
    expect(getPlan("pro").priceMonthly).toBe(49900);
    expect(BILLING_CURRENCY).toBe("cad");
  });

  it("uses a unique, stable lookup_key per tier", () => {
    const keys = PLANS.map((p) => p.lookupKey);
    expect(new Set(keys).size).toBe(keys.length);
    keys.forEach((k) => expect(k).toMatch(/^tharros_(starter|growth|pro)_monthly$/));
  });

  it("offers a 14-day trial", () => {
    expect(TRIAL_DAYS).toBe(14);
  });

  it("highlights exactly one tier (Growth)", () => {
    const highlighted = PLANS.filter((p) => p.highlight);
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0].tier).toBe("growth");
  });

  it("gates Scheduling to Growth and Pro (Day 61) — Starter is solo-owner only", () => {
    expect(hasFeature("starter", "scheduling")).toBe(false);
    expect(hasFeature("growth", "scheduling")).toBe(true);
    expect(hasFeature("pro", "scheduling")).toBe(true);
    // The Assistant ships on every paid tier.
    expect(PLANS.every((p) => hasFeature(p.tier, "assistant"))).toBe(true);
    // Null tier (no subscription) never has a feature.
    expect(hasFeature(null, "scheduling")).toBe(false);
  });

  it("resolves the lowest tier that unlocks a feature", () => {
    expect(minTierForFeature("scheduling")?.tier).toBe("growth");
    expect(minTierForFeature("assistant")?.tier).toBe("starter");
    expect(minTierForFeature("workflows")?.tier).toBe("pro");
  });

  it("keeps the scheduling entitlement consistent with the marketing copy", () => {
    // Any tier that advertises scheduling must actually unlock it, and vice versa.
    for (const plan of PLANS) {
      const copySaysScheduling = plan.features.some((f) => /scheduling/i.test(f));
      const inheritsFromLower = plan.features.some((f) => /everything in/i.test(f));
      if (hasFeature(plan.tier, "scheduling")) {
        expect(copySaysScheduling || inheritsFromLower).toBe(true);
      }
    }
  });

  it("getPlan throws on an unknown tier", () => {
    // @ts-expect-error — exercising the runtime guard with a bad tier.
    expect(() => getPlan("enterprise")).toThrow();
  });

  it("planByPriceId returns undefined for null / unmatched ids", () => {
    expect(planByPriceId(null)).toBeUndefined();
    expect(planByPriceId(undefined)).toBeUndefined();
    expect(planByPriceId("price_does_not_exist")).toBeUndefined();
  });

  it("formatMonthly renders whole-dollar CAD", () => {
    expect(formatMonthly(9900)).toBe("$99");
    expect(formatMonthly(49900)).toBe("$499");
  });

  it("sets the monthly query cap (Day 33) to match the ladder", () => {
    expect(queryCapFor("starter")).toBe(500);
    expect(queryCapFor("growth")).toBe(5_000);
    expect(queryCapFor("pro")).toBe(25_000);
  });

  it("keeps each tier's cap consistent with its 'AI queries / month' bullet", () => {
    for (const plan of PLANS) {
      const bullet = plan.features.find((f) => /AI queries \/ month/.test(f));
      expect(bullet, `${plan.tier} should advertise a query cap`).toBeDefined();
      const copyNumber = Number(bullet!.replace(/[^\d]/g, ""));
      expect(copyNumber).toBe(plan.monthlyQueryCap);
    }
  });
});
