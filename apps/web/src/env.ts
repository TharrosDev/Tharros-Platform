import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Validated environment variables. Importing `env` guarantees every required key
 * is present and well-formed at build/boot — a missing one fails fast with a
 * named error instead of becoming an `undefined` runtime surprise.
 *
 * The server/client split is enforced: `NEXT_PUBLIC_*` keys are the only ones
 * exposed to the browser bundle, and accessing a `server` key from client code
 * throws. See ../../docs/SECRETS.md for where each key comes from.
 *
 * Deferred services are `.optional()` until their phase lands (Stripe webhook →
 * Day 16, Nango → Day 35, n8n → Day 41). Promote one to required only AFTER its
 * value is set in Vercel for all environments, or the next deploy fails here.
 */
export const env = createEnv({
  server: {
    SUPABASE_SECRET_KEY: z.string().min(1),
    ANTHROPIC_API_KEY: z.string().min(1),
    STRIPE_SECRET_KEY: z.string().min(1),
    // Transactional email via Resend (Day 13). Send-only API key; also used as
    // the SMTP password for Supabase Auth's custom SMTP (configured at Supabase,
    // not here). Required — the mailer seam and auth email both depend on it.
    RESEND_API_KEY: z.string().min(1),
    // Default From identity for app-sent mail. Optional — falls back to the
    // canonical address in lib/email/client.ts when unset.
    EMAIL_FROM: z.string().min(1).optional(),
    // Deferred — optional until their phase.
    STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
    NANGO_SECRET_KEY: z.string().min(1).optional(),
    N8N_BASE_URL: z.url().optional(),
    N8N_API_KEY: z.string().min(1).optional(),
    // Sentry build-time source-map upload (optional). Without these the build
    // skips upload — runtime error reporting still works from the DSN alone.
    SENTRY_AUTH_TOKEN: z.string().min(1).optional(),
    SENTRY_ORG: z.string().min(1).optional(),
    SENTRY_PROJECT: z.string().min(1).optional(),
  },
  client: {
    // Canonical public origin (prod = https://tharros.ca). Optional — when unset
    // the app falls back to VERCEL_URL, then localhost. See lib/site-url.ts.
    NEXT_PUBLIC_SITE_URL: z.url().optional(),
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1),
    // Sentry DSN — browser-safe by design. When unset, Sentry init no-ops
    // (no reporting, no cost). See instrumentation*.ts.
    NEXT_PUBLIC_SENTRY_DSN: z.url().optional(),
    // Deferred — optional until Day 35.
    NEXT_PUBLIC_NANGO_PUBLIC_KEY: z.string().min(1).optional(),
  },
  // Next.js inlines process.env access, so each var must be referenced explicitly.
  runtimeEnv: {
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    NANGO_SECRET_KEY: process.env.NANGO_SECRET_KEY,
    N8N_BASE_URL: process.env.N8N_BASE_URL,
    N8N_API_KEY: process.env.N8N_API_KEY,
    SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
    SENTRY_ORG: process.env.SENTRY_ORG,
    SENTRY_PROJECT: process.env.SENTRY_PROJECT,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_NANGO_PUBLIC_KEY: process.env.NEXT_PUBLIC_NANGO_PUBLIC_KEY,
  },
  // Treat "" (e.g. an unset Vercel var) as undefined so optional keys stay optional.
  emptyStringAsUndefined: true,
  // CI builds the app without the production secrets (those live in Vercel, not
  // GitHub). SKIP_ENV_VALIDATION lets the typecheck/build gate run there; it is
  // never set on Vercel, so real deploys still fail fast on a missing key.
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
