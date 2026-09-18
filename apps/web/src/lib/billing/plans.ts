import { env } from "@/env";

import type { Tier } from "./schemas";

/**
 * The subscription catalog is the single source of truth for pricing,
 * Checkout, webhook persistence, plan gating, and public pricing copy.
 *
 * Only capabilities that are shipped in production belong in `products` or
 * the customer-facing feature bullets below. Future products may be described
 * elsewhere as roadmap items, but must never be sold as current entitlements.
 */
export const TRIAL_DAYS = 14;
export const BILLING_CURRENCY = "cad" as const;

export type ProductFeature = "assistant" | "scheduling";

export type Plan = {
  tier: Tier;
  name: string;
  priceMonthly: number;
  products: readonly ProductFeature[];
  lookupKey: string;
  priceId: string | undefined;
  blurb: string;
  highlight: boolean;
  features: string[];
  monthlyQueryCap: number;
};

export const PLANS: readonly Plan[] = [
  {
    tier: "starter",
    name: "Starter",
    priceMonthly: 9900,
    products: ["assistant"],
    lookupKey: "tharros_starter_monthly",
    priceId: env.STRIPE_PRICE_STARTER,
    blurb: "For solo owners who want a reliable AI knowledge assistant.",
    highlight: false,
    features: [
      "AI Business Assistant",
      "Knowledge base and cited answers",
      "Up to 500 AI queries / month",
      "Email support",
    ],
    monthlyQueryCap: 500,
  },
  {
    tier: "growth",
    name: "Growth",
    priceMonthly: 29900,
    products: ["assistant", "scheduling"],
    lookupKey: "tharros_growth_monthly",
    priceId: env.STRIPE_PRICE_GROWTH,
    blurb: "For growing teams that need scheduling and shared business knowledge.",
    highlight: true,
    features: [
      "Everything in Starter",
      "AI Workforce Scheduling",
      "Employee portal, availability, swaps and time off",
      "Up to 5,000 AI queries / month",
      "Priority email support",
    ],
    monthlyQueryCap: 5_000,
  },
  {
    tier: "pro",
    name: "Pro",
    priceMonthly: 49900,
    products: ["assistant", "scheduling"],
    lookupKey: "tharros_pro_monthly",
    priceId: env.STRIPE_PRICE_PRO,
    blurb: "For larger teams that need higher AI capacity and onboarding help.",
    highlight: false,
    features: [
      "Everything in Growth",
      "Up to 25,000 AI queries / month",
      "Priority support",
      "Onboarding help",
    ],
    monthlyQueryCap: 25_000,
  },
] as const;

export function getPlan(tier: Tier): Plan {
  const plan = PLANS.find((p) => p.tier === tier);
  if (!plan) throw new Error(`Unknown plan tier: ${tier}`);
  return plan;
}

export function planByPriceId(priceId: string | null | undefined): Plan | undefined {
  if (!priceId) return undefined;
  return PLANS.find((p) => p.priceId === priceId);
}

export function queryCapFor(tier: Tier): number {
  return getPlan(tier).monthlyQueryCap;
}

export function hasFeature(tier: Tier | null | undefined, feature: ProductFeature): boolean {
  if (!tier) return false;
  return getPlan(tier).products.includes(feature);
}

export function minTierForFeature(feature: ProductFeature): Plan | undefined {
  return PLANS.find((p) => p.products.includes(feature));
}

export function formatMonthly(cents: number): string {
  return `$${Math.round(cents / 100)}`;
}
