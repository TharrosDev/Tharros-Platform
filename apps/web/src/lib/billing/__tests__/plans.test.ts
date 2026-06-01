import { describe, expect, it } from "vitest";

import {
  BILLING_CURRENCY,
  PLANS,
  TRIAL_DAYS,
  formatMonthly,
  getPlan,
  planByPriceId,
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
    expect(getPlan("starter").priceMonthly).toBe(14900);
    expect(getPlan("growth").priceMonthly).toBe(34900);
    expect(getPlan("pro").priceMonthly).toBe(69900);
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
    expect(formatMonthly(14900)).toBe("$149");
    expect(formatMonthly(69900)).toBe("$699");
  });
});
