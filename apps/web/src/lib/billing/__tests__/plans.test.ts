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

describe("billing plans", () => {
  it("defines exactly the three tiers, in ladder order", () => {
    expect(PLANS.map((p) => p.tier)).toEqual(["starter", "growth", "pro"]);
    // PLANS is the self-serve list; Enterprise is sales-led.
    expect([...PLANS.map((p) => p.tier), "enterprise"]).toEqual([...TIERS]);
  });

  it("prices the tiers at the agreed CA$ amounts", () => {
    expect(getPlan("starter").priceMonthly).toBe(9900);
    expect(getPlan("growth").priceMonthly).toBe(29900);
    expect(getPlan("pro").priceMonthly).toBe(49900);
    expect(BILLING_CURRENCY).toBe("cad");
  });

  it("uses a unique stable lookup key per tier", () => {
    const keys = PLANS.map((p) => p.lookupKey);
    expect(new Set(keys).size).toBe(keys.length);
    keys.forEach((k) => expect(k).toMatch(/^tharros_(starter|growth|pro)_monthly$/));
  });

  it("offers a 14-day trial and highlights Growth", () => {
    expect(TRIAL_DAYS).toBe(14);
    expect(PLANS.filter((p) => p.highlight).map((p) => p.tier)).toEqual(["growth"]);
  });

  it("ships the product ladder at the intended tiers", () => {
    expect(PLANS.every((p) => hasFeature(p.tier, "assistant"))).toBe(true);

    expect(hasFeature("starter", "scheduling")).toBe(false);
    expect(hasFeature("growth", "scheduling")).toBe(true);
    expect(hasFeature("pro", "scheduling")).toBe(true);

    expect(hasFeature("starter", "leads")).toBe(false);
    expect(hasFeature("growth", "leads")).toBe(true);
    expect(hasFeature("pro", "leads")).toBe(true);

    expect(hasFeature("growth", "automations")).toBe(false);
    expect(hasFeature("pro", "automations")).toBe(true);
  });

  it("resolves the lowest tier for each shipped feature", () => {
    expect(minTierForFeature("assistant")?.tier).toBe("starter");
    expect(minTierForFeature("scheduling")?.tier).toBe("growth");
    expect(minTierForFeature("leads")?.tier).toBe("growth");
    expect(minTierForFeature("automations")?.tier).toBe("pro");
  });

  it("does not claim external connected tools", () => {
    const copy = PLANS.flatMap((p) => p.features).join(" ");
    expect(copy).not.toMatch(/connected tools|crm integration|nango|n8n/i);
  });

  it("getPlan throws on an unknown tier", () => {
    // @ts-expect-error exercising runtime guard
    expect(() => getPlan("platinum")).toThrow();
  });

  it("Enterprise is sales-led with every product", () => {
    const plan = getPlan("enterprise");
    expect(plan.contactSales).toBe(true);
    expect(hasFeature("enterprise", "automations")).toBe(true);
    expect(PLANS.some((p) => p.tier === "enterprise")).toBe(false);
  });

  it("planByPriceId returns undefined for null or unmatched ids", () => {
    expect(planByPriceId(null)).toBeUndefined();
    expect(planByPriceId(undefined)).toBeUndefined();
    expect(planByPriceId("price_does_not_exist")).toBeUndefined();
  });

  it("formats monthly prices and preserves query caps", () => {
    expect(formatMonthly(9900)).toBe("$99");
    expect(formatMonthly(49900)).toBe("$499");
    expect(queryCapFor("starter")).toBe(500);
    expect(queryCapFor("growth")).toBe(5_000);
    expect(queryCapFor("pro")).toBe(25_000);
  });

  it("keeps query-cap copy consistent with the numeric cap", () => {
    for (const plan of PLANS) {
      const bullet = plan.features.find((f) => /AI queries \/ month/.test(f));
      expect(bullet, `${plan.tier} should advertise a query cap`).toBeDefined();
      expect(Number(bullet!.replace(/[^\d]/g, ""))).toBe(plan.monthlyQueryCap);
    }
  });
});
