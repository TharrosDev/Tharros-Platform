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

export type Plan = {
  tier: Tier;
  name: string;
  /** Monthly amount in cents (Stripe `unit_amount`). */
  priceMonthly: number;
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
};

export const PLANS: readonly Plan[] = [
  {
    tier: "starter",
    name: "Starter",
    priceMonthly: 14900,
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
  },
  {
    tier: "growth",
    name: "Growth",
    priceMonthly: 34900,
    lookupKey: "tharros_growth_monthly",
    priceId: env.STRIPE_PRICE_GROWTH,
    blurb: "For growing teams capturing and following up on leads.",
    highlight: true,
    features: [
      "Everything in Starter",
      "Lead Capture + AI Follow-Up agent",
      "Up to 5 connected tools",
      "Up to 5,000 AI queries / month",
      "Priority email support",
    ],
  },
  {
    tier: "pro",
    name: "Pro",
    priceMonthly: 69900,
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

/** Format a cents amount as a whole-dollar CAD string, e.g. 14900 → "$149". */
export function formatMonthly(cents: number): string {
  return `$${Math.round(cents / 100)}`;
}
