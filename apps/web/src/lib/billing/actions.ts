"use server";

import { getStripe } from "@/lib/billing/client";
import { getPlan, TRIAL_DAYS } from "@/lib/billing/plans";
import { tierSchema, type Tier } from "@/lib/billing/schemas";
import { getOrgContext } from "@/lib/org/queries";
import { getAuthUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { getURL } from "@/lib/site-url";
import { logger } from "@/lib/observability/logger";

/**
 * Day 17 — Stripe Checkout (embedded, subscription mode).
 *
 * Checkout is tied to the active org: one Stripe Customer per org, the org_id
 * carried on the session + subscription as client_reference_id/metadata so the
 * Day-18 webhook can map events back to a tenant. Billing is owner-only (matches
 * the Day-11 owners-only org-update policy). The subscription row is NOT written
 * here — the Day-18 webhook is the source of truth; this only opens Checkout.
 */

class CheckoutError extends Error {}

/**
 * Resolve the owner's active org + ensure it has a Stripe Customer. Throws
 * CheckoutError if the caller isn't the active org's owner. The org's
 * stripe_customer_id is owner-writable under RLS, so the user-session client
 * persists it (no service role needed at this stage).
 */
async function ensureCustomerForOwner() {
  const user = await getAuthUser();
  if (!user) throw new CheckoutError("You must be signed in.");

  const { activeOrg } = await getOrgContext();
  if (!activeOrg) throw new CheckoutError("No active organization.");
  if (activeOrg.role !== "owner") {
    throw new CheckoutError("Only the organization owner can manage billing.");
  }

  const supabase = await createClient();
  const { data: org, error } = await supabase
    .from("organizations")
    .select("id, name, stripe_customer_id")
    .eq("id", activeOrg.id)
    .single();
  if (error || !org) throw new CheckoutError("Could not load your organization.");

  if (org.stripe_customer_id) {
    return { orgId: org.id as string, customerId: org.stripe_customer_id as string };
  }

  // First checkout for this org — create the Customer and persist its id.
  const customer = await getStripe().customers.create({
    email: user.email ?? undefined,
    name: org.name as string,
    metadata: { org_id: org.id as string },
  });

  const { error: updateError } = await supabase
    .from("organizations")
    .update({ stripe_customer_id: customer.id })
    .eq("id", org.id);
  if (updateError) {
    // The Customer exists in Stripe but we couldn't record it. Surface rather
    // than silently orphaning — a retry will reuse it via metadata search later.
    logger.error("billing.persist_customer_failed", {
      org_id: org.id,
      customer_id: customer.id,
      error: updateError.message,
    });
    throw new CheckoutError("Could not save your billing profile. Please retry.");
  }

  return { orgId: org.id as string, customerId: customer.id };
}

/**
 * Create an embedded Checkout Session for `tier` and return its client_secret.
 * Called by the embedded checkout component's `fetchClientSecret`. Throws on a
 * bad tier, a missing Price (catalog not vaulted), or a non-owner caller.
 */
export async function createCheckoutClientSecret(tier: Tier): Promise<string> {
  const parsedTier = tierSchema.safeParse(tier);
  if (!parsedTier.success) throw new CheckoutError("Unknown plan.");

  const plan = getPlan(parsedTier.data);
  if (!plan.priceId) {
    throw new CheckoutError(
      "This plan isn't available yet. Please contact support.",
    );
  }

  const { orgId, customerId } = await ensureCustomerForOwner();

  let session;
  try {
    session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      // The dahlia API renamed ui_mode values: embedded → "embedded_page".
      ui_mode: "embedded_page",
      customer: customerId,
      client_reference_id: orgId,
      // Note: no payment_method_types — dynamic payment methods (Stripe rule).
      line_items: [{ price: plan.priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: TRIAL_DAYS,
        metadata: { org_id: orgId, tier: plan.tier },
      },
      metadata: { org_id: orgId, tier: plan.tier },
      // Card up front even though $0 is due during the trial.
      payment_method_collection: "always",
      // GST/HST: compute tax on the session and let business customers enter a
      // tax id. automatic_tax needs an address, so let Checkout save it to the
      // Customer. NOTE: this requires the merchant's head-office address +
      // a Canada tax registration in the Stripe Dashboard (Tax → Settings /
      // Registrations) — without it Stripe rejects the session. See docs/BILLING.md.
      automatic_tax: { enabled: true },
      tax_id_collection: { enabled: true },
      customer_update: { address: "auto", name: "auto" },
      return_url: `${getURL()}/billing/return?session_id={CHECKOUT_SESSION_ID}`,
    });
  } catch (err) {
    logger.error("billing.checkout_session_failed", {
      org_id: orgId,
      tier: plan.tier,
      error: err instanceof Error ? err.message : String(err),
    });
    throw new CheckoutError("Could not start checkout. Please try again.");
  }

  if (!session.client_secret) {
    throw new CheckoutError("Could not start checkout. Please try again.");
  }
  return session.client_secret;
}

export type CheckoutStatus = {
  status: "complete" | "open" | "expired";
  trialing: boolean;
  tier: Tier | null;
};

/**
 * Retrieve a finished Checkout Session for the /billing/return page. Read-only
 * confirmation — the authoritative subscription record is written by the Day-18
 * webhook, not here.
 */
export async function getCheckoutStatus(
  sessionId: string,
): Promise<CheckoutStatus | null> {
  if (!sessionId) return null;
  // Guard: only the active org's owner may inspect their own session.
  const { activeOrg } = await getOrgContext();
  if (!activeOrg) return null;

  const session = await getStripe().checkout.sessions.retrieve(sessionId, {
    expand: ["subscription"],
  });

  if (session.client_reference_id && session.client_reference_id !== activeOrg.id) {
    return null;
  }

  const sub =
    session.subscription && typeof session.subscription !== "string"
      ? session.subscription
      : null;
  const tier = (session.metadata?.tier as Tier | undefined) ?? null;

  return {
    status: (session.status ?? "open") as CheckoutStatus["status"],
    trialing: sub?.status === "trialing",
    tier,
  };
}
