import { cache } from "react";

import { ACTIVE_STATUSES, type SubscriptionStatus, type Tier } from "@/lib/billing/schemas";
import { hasFeature, type ProductFeature } from "@/lib/billing/plans";
import { getOrgContext } from "@/lib/org/queries";
import { createClient } from "@/lib/supabase/server";

/**
 * Day 19 — plan gating. Turns the active org's `subscriptions` row (written by
 * the Day-18 webhook) into an access decision + banner state. The product route
 * group reads `allowed`; the shell reads `banner`. Read path only — the row is
 * member-readable under RLS, so the user-session client suffices.
 */

/** The slice of the subscriptions row the gate + banners need. */
export type SubscriptionSnapshot = {
  status: SubscriptionStatus;
  tier: Tier | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  trial_ends_at: string | null;
};

export type BannerKind = "trial_ending" | "past_due";

export type Entitlement = {
  /** Product access — true only for an active or trialing subscription. */
  allowed: boolean;
  /** Subscription status, or "none" when the org has no subscription yet. */
  status: SubscriptionStatus | "none";
  /** App-wide banner to show, or null. */
  banner: BannerKind | null;
  /** Whole days left in the trial (only set when banner === "trial_ending"). */
  trialDaysLeft?: number;
};

/** Show the trial-ending banner when the trial has this many days or fewer left. */
const TRIAL_BANNER_THRESHOLD_DAYS = 3;

/**
 * Pure state machine: subscription row → entitlement. Exported for unit testing.
 * `allowed` is the single source of truth for the gate; past_due deliberately
 * does NOT grant access (decided Day 19 — block on payment failure).
 */
export function entitlementFor(sub: SubscriptionSnapshot | null): Entitlement {
  if (!sub) return { allowed: false, status: "none", banner: null };

  const allowed = ACTIVE_STATUSES.includes(sub.status);

  if (sub.status === "past_due" || sub.status === "unpaid") {
    return { allowed, status: sub.status, banner: "past_due" };
  }

  if (sub.status === "trialing" && sub.trial_ends_at) {
    const msLeft = new Date(sub.trial_ends_at).getTime() - Date.now();
    const daysLeft = Math.max(0, Math.ceil(msLeft / 86_400_000));
    if (daysLeft <= TRIAL_BANNER_THRESHOLD_DAYS) {
      return { allowed, status: sub.status, banner: "trial_ending", trialDaysLeft: daysLeft };
    }
  }

  return { allowed, status: sub.status, banner: null };
}

/** The active org's subscription snapshot, or null. Deduped per request. */
export const getSubscription = cache(
  async (): Promise<SubscriptionSnapshot | null> => {
    const { activeOrg } = await getOrgContext();
    if (!activeOrg) return null;

    const supabase = await createClient();
    const { data } = await supabase
      .from("subscriptions")
      .select("status, tier, current_period_end, cancel_at_period_end, trial_ends_at")
      .eq("org_id", activeOrg.id)
      .maybeSingle();

    return (data as SubscriptionSnapshot | null) ?? null;
  },
);

/** The access decision for the active org. Deduped across the gate + shell. */
export const getEntitlement = cache(async (): Promise<Entitlement> => {
  return entitlementFor(await getSubscription());
});

/* --------------------------- Feature gating (Day 61) ---------------------- */

export type FeatureAccess = {
  /** True only when the subscription is active AND the tier unlocks the feature. */
  entitled: boolean;
  /** Why access was denied (for the UI): needs a subscription, or a higher tier. */
  reason: "ok" | "no_subscription" | "not_in_plan";
  /** The org's current tier, if any. */
  tier: Tier | null;
};

/**
 * Pure feature gate: an active subscription is necessary but not sufficient — the
 * tier must also unlock the product feature. Layered on `entitlementFor` so the
 * billing-status rules (past_due blocks, etc.) stay in one place. Exported for
 * unit testing.
 */
export function featureAccessFor(
  sub: SubscriptionSnapshot | null,
  feature: ProductFeature,
): FeatureAccess {
  const tier = sub?.tier ?? null;
  if (!entitlementFor(sub).allowed) return { entitled: false, reason: "no_subscription", tier };
  if (!hasFeature(tier, feature)) return { entitled: false, reason: "not_in_plan", tier };
  return { entitled: true, reason: "ok", tier };
}

/** The active org's access decision for one product feature. Deduped per request. */
export const getFeatureAccess = cache(
  async (feature: ProductFeature): Promise<FeatureAccess> => {
    return featureAccessFor(await getSubscription(), feature);
  },
);
