import "server-only";

import Stripe from "stripe";

import { env } from "@/env";

/**
 * Server-side Stripe client. The single seam every server-side Stripe call goes
 * through — Checkout sessions (Day 17), webhook verification (Day 18), and the
 * customer portal (Day 20) — so swapping keys or adding middleware later touches
 * one file. Mirrors lib/email/client.ts and lib/anthropic/client.ts.
 *
 * `server-only` keeps the secret key out of any client bundle. The key comes
 * from validated `env`, not raw `process.env`, so a missing/blank key fails fast
 * at boot with a named error.
 *
 * `apiVersion` is pinned to the version this installed SDK's types target
 * (stripe-node only ships types for the latest version). Bump it in lockstep
 * when upgrading the `stripe` package. Test mode until Day 99 (live-key swap).
 *
 * Constructed lazily via `getStripe()` — building the app on CI runs with
 * SKIP_ENV_VALIDATION and no STRIPE_SECRET_KEY, and a module-scope `new Stripe()`
 * would throw "Neither apiKey nor config.authenticator provided" while Next
 * collects route config. Lazy init keeps the import side-effect-free; the key is
 * only required when a checkout/webhook call actually runs (always on Vercel).
 */
let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (!client) {
    client = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-05-27.dahlia",
      appInfo: { name: "Tharros Platform" },
      typescript: true,
    });
  }
  return client;
}
