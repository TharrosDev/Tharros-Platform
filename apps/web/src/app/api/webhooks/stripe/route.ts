import type Stripe from "stripe";

import { getStripe } from "@/lib/billing/client";
import { handleStripeEvent } from "@/lib/billing/webhook";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/env";
import { logger } from "@/lib/observability/logger";

// Node runtime: signature verification needs the raw request body + Node crypto.
export const runtime = "nodejs";

/**
 * Day 18 — Stripe webhook endpoint. Signature-verified + idempotent. Persists
 * subscription lifecycle events into `public.subscriptions` via the service-role
 * client (the table's only writer). Excluded from the proxy auth gate so Stripe's
 * unauthenticated POST isn't bounced to /login.
 *
 * Response contract that keeps delivery healthy:
 *   400 — missing/invalid signature or no secret configured (Stripe won't retry a
 *         4xx; the request is simply not trusted)
 *   500 — handler threw (Stripe retries with backoff)
 *   200 — processed, or a duplicate we've already applied
 */
export async function POST(req: Request): Promise<Response> {
  const secret = env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    logger.error("billing.webhook_secret_missing", {});
    return new Response("Webhook not configured", { status: 400 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing signature", { status: 400 });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    // Never log the body or secret — only the failure reason.
    logger.warn("billing.webhook_signature_invalid", {
      error: err instanceof Error ? err.message : String(err),
    });
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    const result = await handleStripeEvent(event, createAdminClient());
    logger.info("billing.webhook_handled", {
      event_id: event.id,
      type: event.type,
      duplicate: "duplicate" in result,
    });
    return new Response(null, { status: 200 });
  } catch (err) {
    logger.error("billing.webhook_handler_failed", {
      event_id: event.id,
      type: event.type,
      error: err instanceof Error ? err.message : String(err),
    });
    // 500 → Stripe retries; the handler's upsert is idempotent so re-runs are safe.
    return new Response("Handler error", { status: 500 });
  }
}
