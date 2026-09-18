import { env } from "@/env";

import type { Tier } from "./schemas";

export const TRIAL_DAYS = 14;
export const BILLING_CURRENCY = "cad" as const;

export type ProductFeature = "assistant" | "scheduling" | "leads" | "automations";

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
    products: ["assistant", "scheduling", "leads"],
    lookupKey: "tharros_growth_monthly",
    priceId: env.STRIPE_PRICE_GROWTH,
    blurb: "For growing teams that need scheduling, lead capture, and shared business knowledge.",
    highlight: true,
    features: [
      "Everything in Starter",
      "AI Workforce Scheduling",
      "Employee portal, availability, swaps and time off",
      "Lead Capture forms and lead pipeline",
      "Human-reviewed AI follow-up drafts",
      "Up to 5,000 AI queries / month",
      "Priority email support",
    ],
    monthlyQueryCap: 5_000,
  },
  {
    tier: "pro",
    name: "Pro",
    priceMonthly: 49900,
    products: ["assistant", "scheduling", "leads", "automations"],
    lookupKey: "tharros_pro_monthly",
    priceId: env.STRIPE_PRICE_PRO,
    blurb: "For teams that want native event-driven automation on top of the full workspace.",
    highlight: false,
    features: [
      "Everything in Growth",
      "Native Automation Hub",
      "Lead-triggered notifications and pipeline actions",
      "Automatic preparation of AI follow-up drafts",
      "Up to 25,000 AI queries / month",
      "Priority support and onboarding help",
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
