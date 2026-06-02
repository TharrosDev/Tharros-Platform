"use client";

import { useCallback } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js";

import { createCheckoutClientSecret } from "@/lib/billing/actions";
import type { Tier } from "@/lib/billing/schemas";

/**
 * Embedded Stripe Checkout for a chosen plan. `loadStripe` is called once at
 * module scope (Stripe's recommended pattern — avoids re-instantiating on every
 * render). The publishable key is browser-safe by design.
 *
 * `fetchClientSecret` calls the server action, which creates the Session tied to
 * the active org and returns its client_secret. The session's return_url
 * (/billing/return) handles the post-payment confirmation.
 */
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
);

export function CheckoutForm({ tier }: { tier: Tier }) {
  const fetchClientSecret = useCallback(
    () => createCheckoutClientSecret(tier),
    [tier],
  );

  return (
    <div id="checkout" className="w-full">
      <EmbeddedCheckoutProvider
        stripe={stripePromise}
        options={{ fetchClientSecret }}
      >
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
