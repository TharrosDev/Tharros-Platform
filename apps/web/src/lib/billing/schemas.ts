import { z } from "zod";

/**
 * Billing domain shapes shared by the plans constant, the Day-17 Checkout
 * action, the Day-18 webhook persister, and the Day-19 gating layer. Mirrors the
 * other domain libs (lib/org/schemas.ts, lib/team/schemas.ts).
 */

/** The three subscription tiers. Source of truth for the union is plans.ts. */
export const TIERS = ["starter", "growth", "pro"] as const;
export type Tier = (typeof TIERS)[number];

export const tierSchema = z.enum(TIERS, { error: "Choose a plan." });

/**
 * Subscription lifecycle states, mirroring Stripe's `Subscription.status` set.
 * The DB `subscriptions.status` check constraint lists the same values; keep the
 * two in sync. `trialing` and `active` are the access-granting states (Day 19).
 */
export const SUBSCRIPTION_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "incomplete",
  "incomplete_expired",
  "unpaid",
  "paused",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/** States in which an org retains product access (used by Day-19 gating). */
export const ACTIVE_STATUSES: readonly SubscriptionStatus[] = ["trialing", "active"];
