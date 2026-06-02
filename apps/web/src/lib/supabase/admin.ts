import "server-only";

import { createClient } from "@supabase/supabase-js";

import { env } from "@/env";

/**
 * Service-role Supabase client. Uses `SUPABASE_SECRET_KEY`, so it **bypasses
 * RLS** — handle with care. This is the only writer to tables that are
 * deny-all / member-read for users: `subscriptions` and `stripe_events` (Day 18
 * webhook). Never import this into client code or a user-facing request path.
 *
 * No session persistence/refresh — it authenticates with the secret key on every
 * request, not a user JWT. Mirrors the inline service client the RLS test harness
 * builds in src/lib/supabase/__tests__/rls.test.ts.
 */
export function createAdminClient() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
