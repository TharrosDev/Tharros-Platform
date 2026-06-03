"use server";

import { revalidatePath } from "next/cache";

import { getAuthUser } from "@/lib/auth/current-user";
import { getOrgContext } from "@/lib/org/queries";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/observability/logger";
import { listConversationsPage, type ConversationPage } from "@/lib/assistant/conversations";

/**
 * Day 29 — conversation mutations for the history panel. Both go through the
 * RLS user-session client: the policies allow an update/delete only for the
 * thread's author or the org owner, so tenancy is enforced by the database.
 */

const ASSISTANT_PATH = "/assistant";
const TITLE_MAX = 120;

type ActionResult = { error?: string };

/** Next keyset page of the history list, scoped to the caller's active org. */
export async function loadMoreConversations(cursor: string | null): Promise<ConversationPage> {
  const { activeOrg } = await getOrgContext();
  if (!activeOrg) return { conversations: [], nextCursor: null };
  return listConversationsPage(activeOrg.id, { cursor });
}

export async function renameConversation(id: string, title: string): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) return { error: "You're signed out. Sign in and try again." };

  const cleaned = title.replace(/\s+/g, " ").trim().slice(0, TITLE_MAX);
  if (!cleaned) return { error: "Give the conversation a name." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("conversations")
    .update({ title: cleaned })
    .eq("id", id);

  if (error) {
    logger.error("assistant.rename_failed", { conversation_id: id, error: error.message });
    return { error: "Couldn't rename the conversation. Please try again." };
  }
  revalidatePath(ASSISTANT_PATH);
  return {};
}

export async function deleteConversation(id: string): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) return { error: "You're signed out. Sign in and try again." };

  const supabase = await createClient();
  const { error } = await supabase.from("conversations").delete().eq("id", id);

  if (error) {
    logger.error("assistant.delete_failed", { conversation_id: id, error: error.message });
    return { error: "Couldn't delete the conversation. Please try again." };
  }
  revalidatePath(ASSISTANT_PATH);
  return {};
}
