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
