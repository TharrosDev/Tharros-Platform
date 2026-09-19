import Stripe from "stripe";
import { describe, expect, it } from "vitest";

import { subscriptionToRow } from "../webhook";

/**
 * Day 18 — webhook unit checks. Pure: the Stripe→row mapping and the signature
 * verification wiring. The DB-touching idempotency/upsert behaviour is covered
 * by webhook.db.test.ts against the test project.
 */

// A minimal Subscription shaped like the dahlia API (period end on the item).
function fakeSub(overrides: Record<string, unknown> = {}): Stripe.Subscription {
  return {
    id: "sub_123",
    status: "trialing",
    customer: "cus_123",
    cancel_at_period_end: false,
    trial_end: 1_900_000_000,
    metadata: { org_id: "org-abc", tier: "growth" },
    items: {
      data: [{ current_period_end: 1_900_500_000, price: { id: "price_x" } }],
    },
    ...overrides,
  } as unknown as Stripe.Subscription;
}

describe("subscriptionToRow", () => {
  it("maps the tenant-relevant fields", () => {
    const row = subscriptionToRow(fakeSub());
    expect(row).not.toBeNull();
    expect(row!).toMatchObject({
      org_id: "org-abc",
      stripe_subscription_id: "sub_123",
      stripe_customer_id: "cus_123",
      status: "trialing",
      tier: null, // unknown price ids never inherit entitlement from metadata
      price_id: "price_x",
      cancel_at_period_end: false,
    });
    // Epoch seconds → ISO for the timestamptz columns.
    expect(row!.current_period_end).toBe(new Date(1_900_500_000_000).toISOString());
    expect(row!.trial_ends_at).toBe(new Date(1_900_000_000_000).toISOString());
  });

  it("reads current_period_end off the first item, not the subscription", () => {
    const row = subscriptionToRow(fakeSub());
    expect(row!.current_period_end).not.toBeNull();
  });

  it("returns null when there is no org_id to map to a tenant", () => {
    expect(subscriptionToRow(fakeSub({ metadata: {} }))).toBeNull();
  });

  it("expands a customer object to its id", () => {
    const row = subscriptionToRow(fakeSub({ customer: { id: "cus_obj" } }));
    expect(row!.stripe_customer_id).toBe("cus_obj");
  });

  it("tolerates a missing trial (trial_ends_at null)", () => {
    const row = subscriptionToRow(fakeSub({ trial_end: null }));
    expect(row!.trial_ends_at).toBeNull();
  });
});

describe("signature verification wiring", () => {
  // generateTestHeaderString + constructEvent are pure crypto over the webhook
  // secret — no API key or network — so a dummy Stripe instance is fine.
  const stripe = new Stripe("sk_test_dummy_for_signing");
  const secret = "whsec_test_secret";

  it("accepts a correctly signed payload", () => {
    const payload = JSON.stringify({ id: "evt_1", type: "ping" });
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
    const event = stripe.webhooks.constructEvent(payload, header, secret);
    expect(event.id).toBe("evt_1");
  });

  it("rejects a tampered payload", () => {
    const payload = JSON.stringify({ id: "evt_1", type: "ping" });
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
    expect(() =>
      stripe.webhooks.constructEvent(payload + " ", header, secret),
    ).toThrow();
  });
});
