import "server-only";

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/observability/logger";
import { type ActivityRow, type ActivitySource } from "@/lib/audit/present";

/**
 * Day 62 — reads for the unified activity feed. The `org_activity_log` RPC is
 * owner/admin-gated SECURITY DEFINER (it's the only read path to the deny-all
 * agent_audit_log), so this calls it through the RLS user-session client with the
 * active org id; a non-manager simply gets no rows.
 */

export const ACTIVITY_PAGE_SIZE = 50;

export type ActivityPage = {
  rows: ActivityRow[];
  /** Cursor for the next (older) page — the oldest row's timestamp — or null. */
  nextBefore: string | null;
  source: ActivitySource | "all";
};

/**
 * One page of the org's activity feed, newest-first. `before` is the keyset
 * cursor (pass the previous page's `nextBefore`); `source` filters client-side to
 * one trail. Over-fetches by 1 to know whether an older page exists.
 */
export async function getActivityPage(
  orgId: string,
  opts?: { before?: string | null; source?: ActivitySource | "all" },
): Promise<ActivityPage> {
  const source = opts?.source ?? "all";
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("org_activity_log", {
    p_org: orgId,
    p_limit: ACTIVITY_PAGE_SIZE + 1,
    p_before: opts?.before ?? null,
  });

  if (error) {
    logger.error("audit.activity_failed", { org_id: orgId, error: error.message });
    return { rows: [], nextBefore: null, source };
  }

  const all = (data ?? []) as ActivityRow[];

  // Cursor advances over the UNIFIED timeline (the RPC paginates the union), so
  // hasMore / nextBefore are computed before the source filter — otherwise a
  // filter that hides this page's tail would strand "load more".
  const hasMore = all.length > ACTIVITY_PAGE_SIZE;
  const page = all.slice(0, ACTIVITY_PAGE_SIZE);
  const nextBefore = hasMore ? page[page.length - 1]?.created_at ?? null : null;

  const rows = source === "all" ? page : page.filter((r) => r.source === source);

  return { rows, nextBefore, source };
}

/**
 * The schedule-changes-only feed for plain members. `scheduling_audit_log` is
 * member-read under RLS, so this reads it directly (no RPC) — members never see
 * the agent_audit_log half (model calls, tool steps), which stays manager-only
 * via `org_activity_log`. Maps the raw row into the same `ActivityRow` shape the
 * presenter consumes (`source: 'schedule'`, no model).
 */
export async function getScheduleActivityPage(
  orgId: string,
  opts?: { before?: string | null },
): Promise<ActivityPage> {
  const supabase = await createClient();

  let query = supabase
    .from("scheduling_audit_log")
    .select("id, actor_type, action, entity_type, entity_id, detail, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(ACTIVITY_PAGE_SIZE + 1);
  if (opts?.before) query = query.lt("created_at", opts.before);

  const { data, error } = await query;
  if (error) {
    logger.error("audit.schedule_activity_failed", { org_id: orgId, error: error.message });
    return { rows: [], nextBefore: null, source: "schedule" };
  }

  const mapped: ActivityRow[] = (
    (data ?? []) as Array<{
      id: string;
      actor_type: string;
      action: string;
      entity_type: string | null;
      entity_id: string | null;
      detail: Record<string, unknown> | null;
      created_at: string;
    }>
  ).map((r) => ({
    id: r.id,
    source: "schedule",
    actor: r.actor_type,
    action: r.action,
    entity_type: r.entity_type,
    entity_id: r.entity_id,
    model: null,
    detail: r.detail,
    created_at: r.created_at,
  }));

  const hasMore = mapped.length > ACTIVITY_PAGE_SIZE;
  const rows = mapped.slice(0, ACTIVITY_PAGE_SIZE);
  const nextBefore = hasMore ? rows[rows.length - 1]?.created_at ?? null : null;

  return { rows, nextBefore, source: "schedule" };
}
