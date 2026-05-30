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
    // Deferred — optional until their phase.
    STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
    NANGO_SECRET_KEY: z.string().min(1).optional(),
    N8N_BASE_URL: z.url().optional(),
    N8N_API_KEY: z.string().min(1).optional(),
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1),
    // Deferred — optional until Day 35.
    NEXT_PUBLIC_NANGO_PUBLIC_KEY: z.string().min(1).optional(),
  },
  // Next.js inlines process.env access, so each var must be referenced explicitly.
  runtimeEnv: {
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    NANGO_SECRET_KEY: process.env.NANGO_SECRET_KEY,
    N8N_BASE_URL: process.env.N8N_BASE_URL,
    N8N_API_KEY: process.env.N8N_API_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_NANGO_PUBLIC_KEY: process.env.NEXT_PUBLIC_NANGO_PUBLIC_KEY,
  },
  // Treat "" (e.g. an unset Vercel var) as undefined so optional keys stay optional.
  emptyStringAsUndefined: true,
});
