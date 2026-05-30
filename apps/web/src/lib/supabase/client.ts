import { createBrowserClient } from "@supabase/ssr";

import { env } from "@/env";

/**
 * Supabase client for use in Client Components (browser).
 * Uses the publishable key, which is safe to expose to the browser.
 */
export function createClient() {
  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
