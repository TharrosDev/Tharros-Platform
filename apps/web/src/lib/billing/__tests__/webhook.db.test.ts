import { createClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { handleStripeEvent } from "../webhook";

/**
 * Day 18 — webhook persistence + idempotency harness.
 *
 * Drives handleStripeEvent with a service-role client against the test project
 * (the same client the route uses in production, built inline here like the
 * Day-11/15 harnesses). Proves: a subscription event upserts the row, a repeat
 * delivery is deduped via stripe_events, and invoice.payment_failed flips status.
 *
 * Run with `pnpm --filter @tharros/web test`.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY!;

const RUN = Date.now().toString(36);
const email = `wh-test-${RUN}@tharros-webhook.test`;
const CUSTOMER = `cus_test_${RUN}`;
const SUB = `sub_test_${RUN}`;

const admin = createClient(SUPABASE_URL, SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let userId = "";
let orgId = "";
const eventIds: string[] = [];

/** Build a customer.subscription.* event tied to our seeded org. */
function subEvent(type: Stripe.Event.Type, status: string, evtSuffix: string): Stripe.Event {
  const id = `evt_${RUN}_${evtSuffix}`;
  eventIds.push(id);
  return {
    id,
    type,
    data: {
      object: {
        id: SUB,
        status,
        customer: CUSTOMER,
        cancel_at_period_end: false,
        trial_end: 1_900_000_000,
        metadata: { org_id: orgId, tier: "growth" },
        items: {
          data: [{ current_period_end: 1_900_500_000, price: { id: "price_x" } }],
        },
      },
    },
  } as unknown as Stripe.Event;
}

function invoiceFailedEvent(evtSuffix: string): Stripe.Event {
  const id = `evt_${RUN}_${evtSuffix}`;
  eventIds.push(id);
  return {
    id,
    type: "invoice.payment_failed",
    data: { object: { id: `in_${RUN}`, customer: CUSTOMER } },
  } as unknown as Stripe.Event;
}

beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: "Test-Pw-Day18-aA1!",
    email_confirm: true,
  });
  if (error) throw error;
  userId = data.user.id;

  // The Day-10 signup trigger auto-provisions a personal org + owner membership.
  const { data: m, error: mErr } = await admin
    .from("memberships")
    .select("org_id")
    .eq("user_id", userId)
    .eq("role", "owner")
    .single();
  if (mErr) throw mErr;
  orgId = m.org_id as string;
});

afterAll(async () => {
  await admin.from("stripe_events").delete().in("id", eventIds);
  // subscriptions cascades on org delete; org cascades on user delete.
  if (orgId) await admin.from("organizations").delete().eq("id", orgId);
  if (userId) await admin.auth.admin.deleteUser(userId);
});

describe("handleStripeEvent", () => {
  it("upserts a subscription row from customer.subscription.created", async () => {
    const res = await handleStripeEvent(
      subEvent("customer.subscription.created", "trialing", "created"),
      admin,
    );
    expect(res).toEqual({ handled: true, type: "customer.subscription.created" });

    const { data } = await admin
      .from("subscriptions")
      .select("status, tier, stripe_subscription_id, stripe_customer_id")
      .eq("org_id", orgId)
      .single();
    expect(data).toMatchObject({
      status: "trialing",
      tier: "growth",
      stripe_subscription_id: SUB,
      stripe_customer_id: CUSTOMER,
    });
  });

  it("dedupes a repeated delivery of the same event id", async () => {
    const evt = subEvent("customer.subscription.updated", "active", "dup");
    const first = await handleStripeEvent(evt, admin);
    expect(first).toEqual({ handled: true, type: "customer.subscription.updated" });
    expect(
      await admin.from("subscriptions").select("status").eq("org_id", orgId).single(),
    ).toMatchObject({ data: { status: "active" } });

    // Re-deliver the SAME event id but with a stale status — must be ignored.
    const stale = {
      ...evt,
      data: {
        object: { ...(evt.data.object as object as Record<string, unknown>), status: "canceled" },
      },
    } as Stripe.Event;
    const second = await handleStripeEvent(stale, admin);
    expect(second).toEqual({ duplicate: true });
    // Status unchanged (still active) — the duplicate did not write.
    expect(
      await admin.from("subscriptions").select("status").eq("org_id", orgId).single(),
    ).toMatchObject({ data: { status: "active" } });
  });

  it("marks past_due on invoice.payment_failed", async () => {
    await handleStripeEvent(invoiceFailedEvent("failed"), admin);
    const { data } = await admin
      .from("subscriptions")
      .select("status")
      .eq("org_id", orgId)
      .single();
    expect(data!.status).toBe("past_due");
  });
});
