import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContentBlockParam, Usage } from "@anthropic-ai/sdk/resources/messages";

import { logger } from "@/lib/observability/logger";
import {
  mapThread,
  mapTurn,
  type AgentThread,
  type AgentThreadRow,
  type AgentTurn,
  type AgentTurnRole,
  type AgentTurnRow,
} from "@/lib/agents/types";

/**
 * Day 39 — read + write data access for agent threads + turns. Mirrors
 * lib/assistant/conversations: writes take an explicit Supabase client (DI) so a
 * single request/runner scope can build it once and the Vitest harness can inject
 * its own. The turn handler uses the service-role admin client (assistant/tool
 * turns have no user-write RLS path); a member posting a 'user' turn can use the
 * RLS user-session client.
 */

const THREAD_COLS =
  "id, org_id, created_by, kind, title, mode, status, taken_over_by, taken_over_at, created_at, updated_at";

/** Create an agent thread; returns its id, or null on failure (logged). */
export async function createThread(
  supabase: SupabaseClient,
  input: { orgId: string; createdBy?: string | null; kind?: string; title?: string },
): Promise<string | null> {
  const row: Record<string, unknown> = { org_id: input.orgId };
  if (input.createdBy !== undefined) row.created_by = input.createdBy;
  if (input.kind !== undefined) row.kind = input.kind;
  if (input.title !== undefined) row.title = input.title;

  const { data, error } = await supabase
    .from("ai_conversation_threads")
    .insert(row)
    .select("id")
    .single();

  if (error) {
    logger.error("agents.create_thread_failed", { org_id: input.orgId, error: error.message });
    return null;
  }
  return (data as { id: string }).id;
}

/** A single thread by id, RLS-scoped to the caller's orgs. null if absent/not visible. */
export async function getThread(
  supabase: SupabaseClient,
  threadId: string,
): Promise<AgentThread | null> {
  const { data, error } = await supabase
    .from("ai_conversation_threads")
    .select(THREAD_COLS)
    .eq("id", threadId)
    .maybeSingle();

  if (error) {
    logger.error("agents.get_thread_failed", { thread_id: threadId, error: error.message });
    return null;
  }
  return data ? mapThread(data as AgentThreadRow) : null;
}

/** The turns of a thread, oldest-first (chronological — the order the loop replays). */
export async function listThreadTurns(
  supabase: SupabaseClient,
  threadId: string,
): Promise<AgentTurn[]> {
  const { data, error } = await supabase
    .from("agent_turns")
    .select("id, thread_id, org_id, role, content, stop_reason, usage, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    logger.error("agents.list_turns_failed", { thread_id: threadId, error: error.message });
    return [];
  }
  return ((data ?? []) as AgentTurnRow[]).map(mapTurn);
}

/** Append one turn to a thread. Returns the new turn id, or null. */
export async function appendTurn(
  supabase: SupabaseClient,
  input: {
    threadId: string;
    orgId: string;
    role: AgentTurnRole;
    content: ContentBlockParam[];
    stopReason?: string | null;
    usage?: Usage | null;
  },
): Promise<string | null> {
  const { data, error } = await supabase
    .from("agent_turns")
    .insert({
      thread_id: input.threadId,
      org_id: input.orgId,
      role: input.role,
      content: input.content,
      stop_reason: input.stopReason ?? null,
      usage: input.usage ?? null,
    })
    .select("id")
    .single();

  if (error) {
    logger.error("agents.append_turn_failed", { thread_id: input.threadId, error: error.message });
    return null;
  }
  return (data as { id: string }).id;
}

/** Bump a thread's updated_at so it sorts to the top. */
export async function touchThread(
  supabase: SupabaseClient,
  threadId: string,
): Promise<void> {
  const { error } = await supabase
    .from("ai_conversation_threads")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", threadId);
  if (error) {
    logger.warn("agents.touch_thread_failed", { thread_id: threadId, error: error.message });
  }
}

/**
 * Manager takeover (AI → human) via the SECURITY DEFINER RPC. Atomic + org-member
 * gated in the DB. Returns the updated thread, or null on failure (logged).
 */
export async function takeOverThread(
  supabase: SupabaseClient,
  threadId: string,
): Promise<AgentThread | null> {
  const { data, error } = await supabase.rpc("take_over_thread", { p_thread: threadId });
  if (error) {
    logger.error("agents.take_over_failed", { thread_id: threadId, error: error.message });
    return null;
  }
  return data ? mapThread(data as AgentThreadRow) : null;
}

/** Release a taken-over thread back to the agent (human → AI) via the RPC. */
export async function releaseThread(
  supabase: SupabaseClient,
  threadId: string,
): Promise<AgentThread | null> {
  const { data, error } = await supabase.rpc("release_thread", { p_thread: threadId });
  if (error) {
    logger.error("agents.release_failed", { thread_id: threadId, error: error.message });
    return null;
  }
  return data ? mapThread(data as AgentThreadRow) : null;
}
