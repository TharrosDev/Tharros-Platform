import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";

import { planByPriceId } from "@/lib/billing/plans";
import type { SubscriptionStatus, Tier } from "@/lib/billing/schemas";
import { logger } from "@/lib/observability/logger";

/**
 * Day 18 — Stripe webhook processing. Persists Stripe subscription lifecycle
 * events into `public.subscriptions` (the app-side mirror), via the service-role
 * client. `subscriptions` is the source of truth Day-19 gating + Day-20 billing
 * read; the webhook is its only writer.
 *
 * The two exports are split so the mapping is unit-testable without a DB and the
 * handler is integration-testable without a live Stripe endpoint.
 */

/** Stable id of the Stripe customer regardless of expand state. */
function customerId(customer: string | { id: string } | null): string | null {
  if (!customer) return null;
  return typeof customer === "string" ? customer : customer.id;
}

function toIso(epochSeconds: number | null | undefined): string | null {
  return epochSeconds ? new Date(epochSeconds * 1000).toISOString() : null;
}

export type SubscriptionRow = {
  org_id: string;
  stripe_subscription_id: string;
  stripe_customer_id: string | null;
  status: SubscriptionStatus;
  tier: Tier | null;
  price_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  trial_ends_at: string | null;
};

/**
 * Map a Stripe Subscription to a `subscriptions` row, or null if we can't tie it
 * to a tenant. The org_id rides on subscription metadata (set by the Day-17
 * Checkout). In the dahlia API `current_period_end` is per-item, not on the
 * subscription — read it off the first item, which also carries the price.
 */
export function subscriptionToRow(sub: Stripe.Subscription): SubscriptionRow | null {
  const orgId = sub.metadata?.org_id;
  if (!orgId) return null;

  const item = sub.items?.data?.[0];
  const priceId = item?.price?.id ?? null;
  // Entitlements come only from a configured Stripe Price id. Subscription
  // metadata is useful for routing, but is not an authorization source.
  const tier = planByPriceId(priceId)?.tier ?? null;

  return {
    org_id: orgId,
    stripe_subscription_id: sub.id,
    stripe_customer_id: customerId(sub.customer),
    status: sub.status as SubscriptionStatus,
    tier,
    price_id: priceId,
    current_period_end: toIso(item?.current_period_end),
    cancel_at_period_end: sub.cancel_at_period_end ?? false,
    trial_ends_at: toIso(sub.trial_end),
  };
}

export type HandleResult =
  | { duplicate: true }
  | { handled: true; type: string };

/**
 * Process one verified Stripe event idempotently. Records the event id only
 * AFTER successful handling, so a mid-failure surfaces (route returns 500) and
 * Stripe retries — the subscription upsert is itself idempotent, so re-runs are
 * safe. A duplicate delivery short-circuits before any write.
 */
export async function handleStripeEvent(
  event: Stripe.Event,
  admin: SupabaseClient,
): Promise<HandleResult> {
  // Already processed? Skip. (Idempotency ledger from migration 20260601150000.)
  const { data: seen, error: seenError } = await admin
    .from("stripe_events")
    .select("id")
    .eq("id", event.id)
    .maybeSingle();
  if (seenError) throw new Error(`stripe_events lookup failed: ${seenError.message}`);
  if (seen) return { duplicate: true };

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const row = subscriptionToRow(sub);
      if (!row) {
        logger.warn("billing.webhook_subscription_no_org", {
          event_id: event.id,
          subscription_id: sub.id,
        });
        break;
      }
      // Cross-check the provider customer against the org row written by our
      // checkout flow. Metadata alone must not be able to move a subscription
      // between tenants.
      if (!row.stripe_customer_id) {
        throw new Error("subscription is missing a Stripe customer");
      }
      const { data: org, error: orgError } = await admin
        .from("organizations")
        .select("id")
        .eq("id", row.org_id)
        .eq("stripe_customer_id", row.stripe_customer_id)
        .maybeSingle();
      if (orgError) throw new Error(`organization billing lookup failed: ${orgError.message}`);
      if (!org) {
        logger.warn("billing.webhook_tenant_binding_mismatch", {
          event_id: event.id,
          subscription_id: sub.id,
          org_id: row.org_id,
          customer_id: row.stripe_customer_id,
        });
        throw new Error("subscription tenant binding mismatch");
      }

      const { error } = await admin
        .from("subscriptions")
        .upsert(row, { onConflict: "org_id" });
      if (error) throw new Error(`subscriptions upsert failed: ${error.message}`);
      break;
    }

    case "invoice.payment_failed": {
      // Defensive: customer.subscription.updated usually also flips the status,
      // but mark past_due directly so access is gated promptly (Day 19).
      const invoice = event.data.object as Stripe.Invoice;
      const cust = customerId(invoice.customer);
      if (cust) {
        const { error } = await admin
          .from("subscriptions")
          .update({ status: "past_due" })
          .eq("stripe_customer_id", cust);
        if (error) throw new Error(`subscriptions past_due update failed: ${error.message}`);
      }
      break;
    }

    default:
      // Unhandled type — still recorded below so Stripe stops retrying.
      break;
  }

  const { error: recordError } = await admin
    .from("stripe_events")
    .insert({ id: event.id, type: event.type });
  // A unique-violation here means a concurrent delivery won the race — harmless
  // (the work above is idempotent). Re-raise anything else.
  if (recordError && recordError.code !== "23505") {
    throw new Error(`stripe_events insert failed: ${recordError.message}`);
  }

  return { handled: true, type: event.type };
}
