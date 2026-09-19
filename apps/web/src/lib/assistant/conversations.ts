import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/observability/logger";
import { PAGE_SIZE, decodeCursor, nextCursorFrom } from "@/lib/pagination";
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
export type ConversationPage = {
  conversations: Conversation[];
  nextCursor: string | null;
};

export async function listConversationsPage(
  orgId: string,
  opts?: { limit?: number; cursor?: string | null },
): Promise<ConversationPage> {
  const supabase = await createClient();
  const limit = opts?.limit ?? PAGE_SIZE.conversations;
  const cursor = decodeCursor(opts?.cursor);

  let q = supabase
    .from("conversations")
    .select("id, title, user_id, created_at, updated_at")
    .eq("org_id", orgId)
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);

  // Keyset: (updated_at, id) strictly before the cursor row, newest-first.
  if (cursor) {
    q = q.or(
      `updated_at.lt.${cursor.ts},and(updated_at.eq.${cursor.ts},id.lt.${cursor.id})`,
    );
  }

  const { data, error } = await q;

  if (error) {
    logger.error("assistant.list_conversations_failed", { org_id: orgId, error: error.message });
    return { conversations: [], nextCursor: null };
  }

  const rows = (data ?? []) as ConversationRow[];
  const names = await resolveAskerNames(supabase, rows.map((r) => r.user_id));

  return {
    conversations: rows.map((r) => ({
      id: r.id,
      title: r.title,
      userId: r.user_id,
      askerName: names.get(r.user_id) ?? null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
    nextCursor: nextCursorFrom(rows, limit, (r) => ({ ts: r.updated_at, id: r.id })),
  };
}

/**
 * A single conversation by id, RLS-scoped (visible to its author or the org
 * owner). Lets the page resolve the `?c=` selection independently of the
 * paginated history list. `null` if absent / not visible.
 */
export async function getConversation(id: string): Promise<Conversation | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("id, title, user_id, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    logger.error("assistant.get_conversation_failed", { conversation_id: id, error: error.message });
    return null;
  }
  if (!data) return null;

  const row = data as ConversationRow;
  const names = await resolveAskerNames(supabase, [row.user_id]);
  return {
    id: row.id,
    title: row.title,
    userId: row.user_id,
    askerName: names.get(row.user_id) ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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

export type MessagePage = {
  /** The most recent page of turns, oldest-first for display. */
  messages: ChatMessage[];
  /** True when older turns exist beyond this page (not yet loaded). */
  truncated: boolean;
};

/**
 * The most recent `limit` turns of a conversation, oldest-first for display.
 * Bounded so a very long thread never ships every message at once; `truncated`
 * tells the UI that earlier turns exist. RLS gates access to the parent.
 */
export async function getConversationMessages(
  conversationId: string,
  opts?: { limit?: number },
): Promise<MessagePage> {
  const supabase = await createClient();
  const limit = opts?.limit ?? PAGE_SIZE.messages;

  // Fetch newest-first (limit + 1 to detect older turns), then flip to ascending.
  const { data, error } = await supabase
    .from("messages")
    .select("id, role, content, citations, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  if (error) {
    logger.error("assistant.get_messages_failed", {
      conversation_id: conversationId,
      error: error.message,
    });
    return { messages: [], truncated: false };
  }

  const rows = (data ?? []) as MessageRow[];
  const truncated = rows.length > limit;
  const page = (truncated ? rows.slice(0, limit) : rows).slice().reverse();

  return {
    messages: page.map((r) => ({
      id: r.id,
      role: r.role,
      content: r.content,
      citations: r.citations ?? [],
      createdAt: r.created_at,
    })),
    truncated,
  };
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
  // Authenticated clients may insert only plain user turns. Assistant-role
  // content/citations/provider usage are system-generated and use the service
  // seam; DB column grants + RLS enforce the same boundary for direct API calls.
  const writer = input.role === "assistant" ? createAdminClient() : supabase;
  // The two branches omit different columns on purpose, so the payload is
  // annotated with the widened shape; a bare union of the two object literals
  // does not satisfy the client's insert parameter type.
  const payload: {
    conversation_id: string;
    org_id: string;
    role: string;
    content: string;
    citations?: Citation[];
    usage?: unknown;
  } =
    input.role === "assistant"
      ? {
          conversation_id: input.conversationId,
          org_id: input.orgId,
          role: "assistant",
          content: input.content,
          citations: input.citations ?? [],
          usage: input.usage ?? null,
        }
      : {
          conversation_id: input.conversationId,
          org_id: input.orgId,
          role: "user",
          content: input.content,
        };

  const { data, error } = await writer
    .from("messages")
    .insert(payload)
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
