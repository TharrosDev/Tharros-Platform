"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext } from "@/lib/org/queries";
import { getAuthUser } from "@/lib/auth/current-user";
import { logger } from "@/lib/observability/logger";
import { appendTurn, getThread, takeOverThread, releaseThread } from "@/lib/agents/threads";
import { recordAuditEvent } from "@/lib/agents/audit";
import { HUMAN_TAKEOVER_STOP_REASON } from "@/lib/agents/present";

/**
 * Day 58 — manager actions behind the conversation-takeover UI. Every action is
 * gated to owner/admin (the takeover RPCs self-gate to org membership, but the
 * UI is a management surface, so we hold the tighter line here too). The takeover
 * flip + release go through the Day-39 SECURITY DEFINER RPCs; a manual reply is
 * written as a human-authored `assistant` turn via the service-role admin client
 * (RLS only lets `authenticated` insert `role='user'` turns) and tagged with the
 * `HUMAN_TAKEOVER_STOP_REASON` sentinel so the transcript can tell it apart from
 * the AI. Status changes use the RLS user-session client (member-update on
 * threads). All writes are audited on `agent_audit_log` (actor='human').
 */

export type ConversationActionState = { ok?: boolean; message?: string };

/** Resolve the caller + their active org, asserting an owner/admin role. */
async function requireManager(): Promise<
  { ok: true; userId: string; orgId: string } | { ok: false; message: string }
> {
  const [user, { activeOrg }] = await Promise.all([getAuthUser(), getOrgContext()]);
  if (!user) return { ok: false, message: "You need to sign in again." };
  if (!activeOrg) return { ok: false, message: "No active organization." };
  if (activeOrg.role !== "owner" && activeOrg.role !== "admin") {
    return { ok: false, message: "Only owners and admins can manage conversations." };
  }
  return { ok: true, userId: user.id, orgId: activeOrg.id };
}

/** Confirm a thread exists and belongs to the manager's active org (RLS-scoped). */
async function assertThreadInOrg(threadId: string, orgId: string): Promise<boolean> {
  const supabase = await createClient();
  const thread = await getThread(supabase, threadId);
  return !!thread && thread.orgId === orgId;
}

/** Take a thread over (AI → human). Flips mode='human' via the Day-39 RPC. */
export async function takeOverThreadAction(
  _prev: ConversationActionState,
  formData: FormData,
): Promise<ConversationActionState> {
  const auth = await requireManager();
  if (!auth.ok) return { message: auth.message };

  const threadId = String(formData.get("threadId") ?? "");
  if (!threadId) return { message: "Missing conversation." };
  if (!(await assertThreadInOrg(threadId, auth.orgId)))
    return { message: "Conversation not found." };

  const supabase = await createClient();
  const updated = await takeOverThread(supabase, threadId);
  if (!updated) return { message: "Could not take over the conversation. Try again." };

  await recordAuditEvent(createAdminClient(), {
    orgId: auth.orgId,
    threadId,
    actor: "human",
    action: "takeover",
    detail: { by: auth.userId },
  });
  revalidatePath(`/scheduling/conversations/${threadId}`);
  revalidatePath("/scheduling/conversations");
  return { ok: true, message: "You're now handling this conversation." };
}

/** Hand a thread back to the agent (human → AI) via the Day-39 RPC. */
export async function releaseThreadAction(
  _prev: ConversationActionState,
  formData: FormData,
): Promise<ConversationActionState> {
  const auth = await requireManager();
  if (!auth.ok) return { message: auth.message };

  const threadId = String(formData.get("threadId") ?? "");
  if (!threadId) return { message: "Missing conversation." };
  if (!(await assertThreadInOrg(threadId, auth.orgId)))
    return { message: "Conversation not found." };

  const supabase = await createClient();
  const updated = await releaseThread(supabase, threadId);
  if (!updated) return { message: "Could not release the conversation. Try again." };

  await recordAuditEvent(createAdminClient(), {
    orgId: auth.orgId,
    threadId,
    actor: "human",
    action: "release",
    detail: { by: auth.userId },
  });
  revalidatePath(`/scheduling/conversations/${threadId}`);
  revalidatePath("/scheduling/conversations");
  return { ok: true, message: "Conversation handed back to the agent." };
}

/**
 * Post a manual reply as the manager. Requires the thread to be human-owned
 * (take it over first) so a reply can't race the live agent. Written as an
 * `assistant` turn via the admin client, tagged with the takeover sentinel.
 */
export async function postManualReplyAction(
  _prev: ConversationActionState,
  formData: FormData,
): Promise<ConversationActionState> {
  const auth = await requireManager();
  if (!auth.ok) return { message: auth.message };

  const threadId = String(formData.get("threadId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!threadId) return { message: "Missing conversation." };
  if (!body) return { message: "Write a reply first." };
  if (body.length > 4000) return { message: "That reply is too long (4000 character max)." };

  // Re-read under RLS to confirm org + that the manager actually holds the thread.
  const supabase = await createClient();
  const thread = await getThread(supabase, threadId);
  if (!thread || thread.orgId !== auth.orgId) return { message: "Conversation not found." };
  if (thread.mode !== "human") {
    return { message: "Take the conversation over before replying." };
  }

  const admin = createAdminClient();
  const turnId = await appendTurn(admin, {
    threadId,
    orgId: auth.orgId,
    role: "assistant",
    content: [{ type: "text", text: body }],
    stopReason: HUMAN_TAKEOVER_STOP_REASON,
  });
  if (!turnId) return { message: "Could not send the reply. Try again." };

  // Bump the thread so it sorts to the top of the inbox.
  await admin
    .from("ai_conversation_threads")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", threadId);

  await recordAuditEvent(admin, {
    orgId: auth.orgId,
    threadId,
    turnId,
    actor: "human",
    action: "manual_reply",
    detail: { by: auth.userId, chars: body.length },
  });
  revalidatePath(`/scheduling/conversations/${threadId}`);
  revalidatePath("/scheduling/conversations");
  return { ok: true, message: "Reply sent." };
}

/** Mark a conversation resolved (closed) or reopen it. Member-update via RLS. */
export async function setThreadStatusAction(
  _prev: ConversationActionState,
  formData: FormData,
): Promise<ConversationActionState> {
  const auth = await requireManager();
  if (!auth.ok) return { message: auth.message };

  const threadId = String(formData.get("threadId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!threadId) return { message: "Missing conversation." };
  if (status !== "open" && status !== "closed") return { message: "Invalid status." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("ai_conversation_threads")
    .update({ status })
    .eq("id", threadId);
  if (error) {
    logger.error("agents.set_status_failed", { threadId, status, error: error.message });
    return { message: "Could not update the conversation. Try again." };
  }

  await recordAuditEvent(createAdminClient(), {
    orgId: auth.orgId,
    threadId,
    actor: "human",
    action: status === "closed" ? "thread_resolved" : "thread_reopened",
    detail: { by: auth.userId },
  });
  revalidatePath(`/scheduling/conversations/${threadId}`);
  revalidatePath("/scheduling/conversations");
  return { ok: true, message: status === "closed" ? "Marked resolved." : "Conversation reopened." };
}
