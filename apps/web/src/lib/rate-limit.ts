import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/observability/logger";

/**
 * App-level sliding-window rate limit, backed by the `check_rate_limit` RPC
 * (Postgres-based — no Redis/Upstash). Records one attempt for `key` and returns
 * whether the caller is still within `max` attempts per `windowSeconds`.
 *
 * Fails OPEN: if the RPC errors (e.g. transient DB blip) we log and allow the
 * action, so a throttle malfunction never locks legitimate users out. The point
 * is abuse mitigation, not a hard security boundary.
 */
export async function checkRateLimit(
  key: string,
  max: number,
  windowSeconds: number,
  options: { failOpen?: boolean } = {},
): Promise<{ allowed: boolean }> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_key: key,
    p_max: max,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    const failOpen = options.failOpen ?? true;
    logger.warn("rate-limit check failed", { err: error, key, failOpen });
    return { allowed: failOpen };
  }

  return { allowed: data === true };
}
