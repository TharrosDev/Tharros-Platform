import { env } from "@/env";

import type { Tier } from "./schemas";

/**
 * The Tharros subscription catalog — the single source of truth the marketing
 * pricing page (Day 16), Checkout (Day 17), the webhook persister (Day 18), and
 * plan gating (Day 19) all read from.
 *
 * Pricing model: flat monthly per business (not per seat). Three tiers. The
 * dollar amounts here are mirrored by the Stripe Products/Prices created by
 * scripts/stripe/setup-products.mjs — keep them in sync, and re-run that script
 * (it is idempotent) if an amount changes.
 *
 * `priceId` is resolved from env so the same code points at test vs live Prices
 * without a redeploy. `lookupKey` is the stable, environment-independent handle
 * (set as the Stripe Price `lookup_key`); Checkout resolves the live Price by it
 * if an env ID is ever missing.
 */

/** Trial length, in days. Card is collected up front at Checkout (Day 17). */
export const TRIAL_DAYS = 14;

/** ISO 4217 currency for all Prices. Canadian SMB product. */
export const BILLING_CURRENCY = "cad" as const;

/**
 * Product capabilities a plan unlocks (Day 61 feature gating). Distinct from the
 * marketing `features` bullets: this is the typed set the route gates read.
 * `assistant` ships on every paid plan; `scheduling` is a team feature (Growth+,
 * since Starter targets solo owners with no staff to schedule); `leads` /
 * `workflows` are reserved for their later phases.
 */
export type ProductFeature = "assistant" | "scheduling" | "leads" | "workflows";

export type Plan = {
  tier: Tier;
  name: string;
  /** Monthly amount in cents (Stripe `unit_amount`). */
  priceMonthly: number;
  /** Typed product capabilities this tier unlocks — the feature-gate source. */
  products: readonly ProductFeature[];
  /** Stable Stripe Price `lookup_key`, independent of test/live. */
  lookupKey: string;
  /** Resolved Stripe Price ID for the current mode; undefined until vaulted. */
  priceId: string | undefined;
  /** Short positioning line for the pricing card. */
  blurb: string;
  /** Whether to flag this card as "Most popular" on the pricing page. */
  highlight: boolean;
  /** Feature bullets — differentiate on connectors, AI/workflow volume, support. */
  features: string[];
  /**
   * Assistant queries allowed per calendar month (Day 33 cost cap). Must match
   * the "Up to N AI queries / month" feature bullet above — this number is the
   * one the enforcement layer reads (`queryCapFor`); the bullet is just copy.
   */
  monthlyQueryCap: number;
};

export const PLANS: readonly Plan[] = [
  {
    tier: "starter",
    name: "Starter",
    priceMonthly: 14900,
    products: ["assistant"],
    lookupKey: "tharros_starter_monthly",
    priceId: env.STRIPE_PRICE_STARTER,
    blurb: "For solo owners getting their first systems in place.",
    highlight: false,
    features: [
      "AI Business Assistant",
      "1 connected tool",
      "Up to 500 AI queries / month",
      "Email support",
    ],
    monthlyQueryCap: 500,
  },
  {
    tier: "growth",
    name: "Growth",
    priceMonthly: 34900,
    products: ["assistant", "scheduling"],
    lookupKey: "tharros_growth_monthly",
    priceId: env.STRIPE_PRICE_GROWTH,
    blurb: "For growing teams capturing and following up on leads.",
    highlight: true,
    features: [
      "Everything in Starter",
      "AI Workforce Scheduling",
      "Lead Capture + AI Follow-Up agent",
      "Up to 5 connected tools",
      "Up to 5,000 AI queries / month",
      "Priority email support",
    ],
    monthlyQueryCap: 5_000,
  },
  {
    tier: "pro",
    name: "Pro",
    priceMonthly: 69900,
    products: ["assistant", "scheduling", "workflows"],
    lookupKey: "tharros_pro_monthly",
    priceId: env.STRIPE_PRICE_PRO,
    blurb: "For businesses automating work across every tool.",
    highlight: false,
    features: [
      "Everything in Growth",
      "Workflow Automation Hub",
      "Unlimited connected tools",
      "Up to 25,000 AI queries / month",
      "Priority support with onboarding help",
    ],
    monthlyQueryCap: 25_000,
  },
] as const;

/** Look up a plan by tier. Throws on an unknown tier (programmer error). */
export function getPlan(tier: Tier): Plan {
  const plan = PLANS.find((p) => p.tier === tier);
  if (!plan) throw new Error(`Unknown plan tier: ${tier}`);
  return plan;
}

/**
 * Resolve a plan from a Stripe Price ID (Day-18 webhook + Day-19 gating map a
 * subscription's price back to a tier). Returns undefined if no env Price ID
 * matches — callers should treat that as "unknown plan".
 */
export function planByPriceId(priceId: string | null | undefined): Plan | undefined {
  if (!priceId) return undefined;
  return PLANS.find((p) => p.priceId === priceId);
}

/**
 * The monthly assistant-query cap for a tier (Day 33 cost control). The single
 * number the enforcement layer reads — mirrors the tier's pricing-page copy.
 */
export function queryCapFor(tier: Tier): number {
  return getPlan(tier).monthlyQueryCap;
}

/**
 * Whether a tier unlocks a product feature (Day 61 gating). Null/undefined tier
 * (no/unknown subscription) never has a feature. Pure — the route gate + the
 * pricing page both read it.
 */
export function hasFeature(tier: Tier | null | undefined, feature: ProductFeature): boolean {
  if (!tier) return false;
  return getPlan(tier).products.includes(feature);
}

/** The lowest tier that unlocks `feature` (for "upgrade to X" copy), or undefined. */
export function minTierForFeature(feature: ProductFeature): Plan | undefined {
  return PLANS.find((p) => p.products.includes(feature));
}

/** Format a cents amount as a whole-dollar CAD string, e.g. 14900 → "$149". */
export function formatMonthly(cents: number): string {
  return `$${Math.round(cents / 100)}`;
}
