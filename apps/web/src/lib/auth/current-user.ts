import { cache } from "react";
import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

/**
 * The authenticated user for the current request, or null.
 *
 * `getUser()` verifies the JWT with Supabase on every call (a network round
 * trip) — and several server components need it in one render: the (app),
 * (auth), and (onboarding) layouts plus `getOrgContext()`. Wrapping it in
 * React `cache()` collapses those into a single verification per request while
 * keeping each call site's authoritative check intact.
 *
 * The proxy (middleware) keeps its own `getUser()` — it runs in a different
 * request lifecycle and is required there for cookie refresh.
 */
export const getAuthUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
