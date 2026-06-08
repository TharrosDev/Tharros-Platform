import "server-only";

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/observability/logger";
import { mapThread, type AgentThread, type AgentThreadRow } from "@/lib/agents/types";

/**
 * Day 58 — read access for the conversation-takeover UI. Operational agent
 * threads are org-wide readable (Day-39 RLS), so these use the RLS user-session
 * client and never re-filter by org. The detail page reuses `getThread` /
 * `listThreadTurns` from `lib/agents/threads`; this module adds the list + a
 * cheap last-activity / turn-count rollup the inbox needs.
 */

const THREAD_COLS =
  "id, org_id, created_by, kind, title, mode, status, taken_over_by, taken_over_at, created_at, updated_at";

export type ThreadListItem = AgentThread & {
  /** Number of turns logged on the thread (for the list preview). */
  turnCount: number;
  /** First lines of the most recent turn, trimmed for the list. */
  lastSnippet: string | null;
};

/**
 * The org's operational agent threads, newest-activity first. `mode='ai'` system
 * threads and manager-owned threads alike — the UI badges them. Bounded.
 */
export async function listOrgThreads(opts?: { limit?: number }): Promise<ThreadListItem[]> {
  const supabase = await createClient();

  const { data: threadRows, error } = await supabase
    .from("ai_conversation_threads")
    .select(THREAD_COLS)
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(opts?.limit ?? 50);

  if (error) {
    logger.error("agents.list_threads_failed", { error: error.message });
    return [];
  }

  const threads = ((threadRows ?? []) as AgentThreadRow[]).map(mapThread);
  if (threads.length === 0) return [];

  // One round-trip for the previews: the latest text turn per listed thread.
  const ids = threads.map((t) => t.id);
  const { data: turnRows, error: turnsErr } = await supabase
    .from("agent_turns")
    .select("thread_id, content, created_at")
    .in("thread_id", ids)
    .order("created_at", { ascending: false });

  if (turnsErr) {
    logger.warn("agents.list_thread_turns_failed", { error: turnsErr.message });
  }

  const counts = new Map<string, number>();
  const snippets = new Map<string, string>();
  for (const row of (turnRows ?? []) as Array<{
    thread_id: string;
    content: Array<{ type?: string; text?: string }> | null;
    created_at: string;
  }>) {
    counts.set(row.thread_id, (counts.get(row.thread_id) ?? 0) + 1);
    // Rows arrive newest-first, so the first text we see per thread is the latest.
    if (!snippets.has(row.thread_id)) {
      const text = (row.content ?? [])
        .filter((b) => b.type === "text" && typeof b.text === "string")
        .map((b) => b.text as string)
        .join(" ")
        .trim();
      if (text) snippets.set(row.thread_id, text.slice(0, 140));
    }
  }

  return threads.map((t) => ({
    ...t,
    turnCount: counts.get(t.id) ?? 0,
    lastSnippet: snippets.get(t.id) ?? null,
  }));
}
