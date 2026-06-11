import "server-only";

import type { Usage } from "@anthropic-ai/sdk/resources/messages";

/**
 * The token-count subset metering actually records. The full Anthropic `Usage`
 * satisfies this, and DeepSeek usage is mapped into it (lib/deepseek/usage.ts) —
 * so both providers meter through the one `recordUsage` seam.
 */
export type MeteredUsage = Pick<
  Usage,
  "input_tokens" | "output_tokens" | "cache_read_input_tokens" | "cache_creation_input_tokens"
>;

import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/observability/logger";
import { getSubscription } from "@/lib/billing/entitlements";
import { queryCapFor } from "@/lib/billing/plans";
import { capDecision, currentUsagePeriodStart, type CapDecision } from "@/lib/billing/usage-math";

/**
 * Day 33 — per-org AI usage metering + plan-cap enforcement.
 *
 * Writes go through the service-role admin client (the `ai_usage_events` table
 * has no user-write RLS policy, mirroring `subscriptions` / `document_chunks`).
 * Reads for the cap check also use the admin client so a count is never shaped
 * by RLS; the owner dashboard reads the member-readable `ai_usage_summary` RPC
 * through the user-session client instead.
 */

/**
 * Record one Claude call's token usage for an org. Best-effort: metering must
 * never break a paid answer, so a failure is logged and swallowed. `usage` is
 * the Anthropic SDK `Usage` (or null on a path that made no call — skipped).
 */
export async function recordUsage(
  orgId: string,
  userId: string | null,
  model: string,
  usage: MeteredUsage | null,
): Promise<void> {
  if (!usage) return;

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("ai_usage_events").insert({
      org_id: orgId,
      user_id: userId,
      model,
      input_tokens: usage.input_tokens ?? 0,
      output_tokens: usage.output_tokens ?? 0,
      cache_read_tokens: usage.cache_read_input_tokens ?? 0,
      cache_creation_tokens: usage.cache_creation_input_tokens ?? 0,
    });
    if (error) {
      logger.warn("usage.record_failed", { org_id: orgId, err: error });
    }
  } catch (err) {
    logger.warn("usage.record_failed", { org_id: orgId, err });
  }
}

/**
 * Count an org's assistant queries in the current billing period (UTC month).
 * Uses the admin client so the count is the true total regardless of RLS.
 */
export async function getMonthlyQueryCount(orgId: string): Promise<number> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("ai_usage_events")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .gte("created_at", currentUsagePeriodStart().toISOString());

  if (error) {
    logger.warn("usage.count_failed", { org_id: orgId, err: error });
    // Fail OPEN on a counting error (mirrors checkRateLimit) — don't lock a
    // paying customer out of the product over a transient DB hiccup.
    return 0;
  }
  return count ?? 0;
}

/**
 * Extra queries awarded to the org for the current month (approved feedback
 * rewards). Deny-all table, read via the admin client. Fails closed to 0 —
 * a bonus is a perk, not an entitlement, so a read error never widens the cap.
 */
export async function getMonthlyBonusQueries(orgId: string): Promise<number> {
  const admin = createAdminClient();
  const month = currentUsagePeriodStart().toISOString().slice(0, 10);
  const { data, error } = await admin
    .from("usage_bonuses")
    .select("queries")
    .eq("org_id", orgId)
    .eq("month", month);

  if (error) {
    logger.warn("usage.bonus_read_failed", { org_id: orgId, err: error });
    return 0;
  }
  return ((data ?? []) as Array<{ queries: number }>).reduce((sum, b) => sum + b.queries, 0);
}

/**
 * Decide whether `orgId` may run another assistant query this period, based on
 * its plan tier's monthly cap plus any approved feedback bonus queries. An org
 * with no tier (no/unknown subscription) gets cap 0 → blocked; in practice the
 * (subscribed) route group has already required an active/trialing
 * subscription before this runs.
 */
export async function checkQueryCap(orgId: string): Promise<CapDecision> {
  const sub = await getSubscription();
  const planCap = sub?.tier ? queryCapFor(sub.tier) : 0;
  // A bonus extends a real plan's cap; it never unlocks an unsubscribed org.
  const bonus = planCap > 0 ? await getMonthlyBonusQueries(orgId) : 0;
  const used = await getMonthlyQueryCount(orgId);
  return capDecision(used, planCap + bonus);
}
