import "server-only";

import type { Usage } from "@anthropic-ai/sdk/resources/messages";

export type MeteredUsage = Pick<
  Usage,
  "input_tokens" | "output_tokens" | "cache_read_input_tokens" | "cache_creation_input_tokens"
>;

import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/observability/logger";
import { getSubscription } from "@/lib/billing/entitlements";
import { queryCapFor } from "@/lib/billing/plans";
import {
  ACTIVE_STATUSES,
  type SubscriptionStatus,
  type Tier,
} from "@/lib/billing/schemas";
import { capDecision, currentUsagePeriodStart, type CapDecision } from "@/lib/billing/usage-math";

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
    if (error) logger.warn("usage.record_failed", { org_id: orgId, err: error });
  } catch (err) {
    logger.warn("usage.record_failed", { org_id: orgId, err });
  }
}

export async function getMonthlyQueryCount(orgId: string): Promise<number> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("ai_usage_events")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .gte("created_at", currentUsagePeriodStart().toISOString());

  if (error) {
    logger.warn("usage.count_failed", { org_id: orgId, err: error });
    return 0;
  }
  return count ?? 0;
}

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
  return ((data ?? []) as Array<{ queries: number }>).reduce((sum, bonus) => sum + bonus.queries, 0);
}

async function decisionForCap(orgId: string, planCap: number): Promise<CapDecision> {
  const bonus = planCap > 0 ? await getMonthlyBonusQueries(orgId) : 0;
  const used = await getMonthlyQueryCount(orgId);
  return capDecision(used, planCap + bonus);
}

export async function checkQueryCap(orgId: string): Promise<CapDecision> {
  const sub = await getSubscription();
  const planCap = sub?.tier ? queryCapFor(sub.tier) : 0;
  return decisionForCap(orgId, planCap);
}

/**
 * Background-safe cap check. Durable jobs have no user request/cookie context,
 * so they cannot use getSubscription(), which resolves the active org from the
 * current session. Automated AI work reads the org's subscription directly and
 * fails closed on a subscription read error.
 */
export async function checkOrgQueryCap(orgId: string): Promise<CapDecision> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("subscriptions")
    .select("status, tier")
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) {
    logger.warn("usage.background_subscription_failed", { org_id: orgId, err: error });
    return decisionForCap(orgId, 0);
  }

  const row = data as { status?: SubscriptionStatus; tier?: Tier | null } | null;
  const active =
    row?.status !== undefined && ACTIVE_STATUSES.includes(row.status) && row.tier !== null;
  const planCap = active && row?.tier ? queryCapFor(row.tier) : 0;
  return decisionForCap(orgId, planCap);
}
