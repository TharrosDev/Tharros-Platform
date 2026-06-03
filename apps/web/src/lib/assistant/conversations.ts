import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/observability/logger";
import type { Citation } from "@/lib/documents/rag-prompt";
import type { ChatMessage, Conversation } from "@/lib/assistant/types";

/**
 * Day 29 — read + write data access for assistant chat. Everything goes through
 * the RLS user-session client: a conversation is visible to its author and to
 * the org owner (the policy enforces it), so these queries don't re-filter for
 * safety — they just pick the active org out of the caller's visible set.
 *
 * Writes (`createConversation`, `appendMessage`, `touchConversation`) take an
 * explicit client so the streaming route can build it once in the request scope
 * and reuse it inside the response stream, rather than calling `cookies()` late.
 */

const TITLE_MAX = 80;

/** Derive a conversation title from the first question: trimmed, single-spaced, capped. */
export function conversationTitle(question: string): string {
  const cleaned = question.replace(/\s+/g, " ").trim();
  if (!cleaned) return "New conversation";
  return cleaned.length > TITLE_MAX ? cleaned.slice(0, TITLE_MAX - 1).trimEnd() + "…" : cleaned;
}

type ConversationRow = {
  id: string;
  title: string;
  user_id: string;
  created_at: string;
  updated_at: string;
};

/**
 * Conversations visible to the caller in `orgId`, newest-first. For an org owner
 * this includes co-workers' threads; the author display name is resolved with a
 * second `profiles` query (no FK from conversations→profiles, so PostgREST can't
 * embed it — same join-in-JS pattern as the team page).
 */
export async function listConversations(orgId: string): Promise<Conversation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("id, title, user_id, created_at, updated_at")
    .eq("org_id", orgId)
    .order("updated_at", { ascending: false });

  if (error) {
    logger.error("assistant.list_conversations_failed", { org_id: orgId, error: error.message });
    return [];
  }

  const rows = (data ?? []) as ConversationRow[];
  const names = await resolveAskerNames(supabase, rows.map((r) => r.user_id));

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    userId: r.user_id,
    askerName: names.get(r.user_id) ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

/** Resolve user_id → display name (full_name, else email) for the owner's view. */
async function resolveAskerNames(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<Map<string, string>> {
  const ids = [...new Set(userIds)];
  const names = new Map<string, string>();
  if (ids.length === 0) return names;

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", ids);

  for (const p of (data ?? []) as { id: string; full_name: string | null; email: string | null }[]) {
    const name = p.full_name?.trim() || p.email || null;
    if (name) names.set(p.id, name);
  }
  return names;
}

type MessageRow = {
  id: string;
  role: ChatMessage["role"];
  content: string;
  citations: Citation[] | null;
  created_at: string;
};

/** Messages of a conversation, oldest-first. RLS gates access to the parent. */
export async function getConversationMessages(conversationId: string): Promise<ChatMessage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("messages")
    .select("id, role, content, citations, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    logger.error("assistant.get_messages_failed", {
      conversation_id: conversationId,
      error: error.message,
    });
    return [];
  }

  return ((data ?? []) as MessageRow[]).map((r) => ({
    id: r.id,
    role: r.role,
    content: r.content,
    citations: r.citations ?? [],
    createdAt: r.created_at,
  }));
}

/** Create a new conversation; returns its id, or null on failure (logged). */
export async function createConversation(
  supabase: SupabaseClient,
  input: { orgId: string; userId: string; title: string },
): Promise<string | null> {
  const { data, error } = await supabase
    .from("conversations")
    .insert({ org_id: input.orgId, user_id: input.userId, title: input.title })
    .select("id")
    .single();

  if (error) {
    logger.error("assistant.create_conversation_failed", {
      org_id: input.orgId,
      error: error.message,
    });
    return null;
  }
  return (data as { id: string }).id;
}

/** Append one turn to a conversation. Returns the new message id, or null. */
export async function appendMessage(
  supabase: SupabaseClient,
  input: {
    conversationId: string;
    orgId: string;
    role: ChatMessage["role"];
    content: string;
    citations?: Citation[];
    usage?: unknown;
  },
): Promise<string | null> {
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: input.conversationId,
      org_id: input.orgId,
      role: input.role,
      content: input.content,
      citations: input.citations ?? [],
      usage: input.usage ?? null,
    })
    .select("id")
    .single();

  if (error) {
    logger.error("assistant.append_message_failed", {
      conversation_id: input.conversationId,
      error: error.message,
    });
    return null;
  }
  return (data as { id: string }).id;
}

/** Bump a conversation's updated_at so it sorts to the top of the history. */
export async function touchConversation(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<void> {
  const { error } = await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);
  if (error) {
    logger.warn("assistant.touch_conversation_failed", {
      conversation_id: conversationId,
      error: error.message,
    });
  }
}
