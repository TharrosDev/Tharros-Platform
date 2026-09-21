import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Validated runtime configuration for the production product.
 *
 * Shipped capabilities fail fast when their required provider configuration is
 * missing. Optional keys are limited to observability and environment-specific
 * conveniences; future-product provider keys do not live in the production
 * contract until those products ship.
 */
export const env = createEnv({
  server: {
    SUPABASE_SECRET_KEY: z.string().min(1),
    ANTHROPIC_API_KEY: z.string().min(1),
    OPENAI_API_KEY: z.string().min(1),
    STRIPE_SECRET_KEY: z.string().min(1),
    STRIPE_WEBHOOK_SECRET: z.string().min(1),
    RESEND_API_KEY: z.string().min(1),
    // Runtime-only secrets whose consumers already fail closed on absence:
    // lib/deepseek/client.ts throws before any request, and the cron route
    // answers 503 "Cron not configured". Requiring them here additionally
    // failed `next build`, which needs neither, so a deploy could not be cut
    // at all while they were unvaulted. /api/health still counts both as
    // required shipped configuration and reports "incomplete" until they are
    // set, so the operator signal is preserved.
    DEEPSEEK_API_KEY: z.string().min(1).optional(),
    CRON_SECRET: z.string().min(1).optional(),
    EMAIL_FROM: z.string().min(1).optional(),
    STRIPE_PRICE_STARTER: z.string().min(1).optional(),
    STRIPE_PRICE_GROWTH: z.string().min(1).optional(),
    STRIPE_PRICE_PRO: z.string().min(1).optional(),
    STRIPE_PRICE_ENTERPRISE: z.string().min(1).optional(),
    SENTRY_AUTH_TOKEN: z.string().min(1).optional(),
    SENTRY_ORG: z.string().min(1).optional(),
    SENTRY_PROJECT: z.string().min(1).optional(),
  },
  client: {
    NEXT_PUBLIC_SITE_URL: z.url().optional(),
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1),
    NEXT_PUBLIC_SENTRY_DSN: z.url().optional(),
  },
  runtimeEnv: {
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    CRON_SECRET: process.env.CRON_SECRET,
    EMAIL_FROM: process.env.EMAIL_FROM,
    STRIPE_PRICE_STARTER: process.env.STRIPE_PRICE_STARTER,
    STRIPE_PRICE_GROWTH: process.env.STRIPE_PRICE_GROWTH,
    STRIPE_PRICE_PRO: process.env.STRIPE_PRICE_PRO,
    STRIPE_PRICE_ENTERPRISE: process.env.STRIPE_PRICE_ENTERPRISE,
    SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
    SENTRY_ORG: process.env.SENTRY_ORG,
    SENTRY_PROJECT: process.env.SENTRY_PROJECT,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  },
  emptyStringAsUndefined: true,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
