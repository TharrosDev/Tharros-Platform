"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/auth/current-user";
import { getOrgContext } from "@/lib/org/queries";
import { checkQueryCap, recordUsage } from "@/lib/billing/usage";
import { chatCompletion } from "@/lib/deepseek/client";
import { mapDeepSeekUsage } from "@/lib/deepseek/usage";
import { logger } from "@/lib/observability/logger";
import { runFeedbackTurn, type FeedbackKind, type FeedbackMessage } from "@/lib/feedback/agent";

/**
 * The feedback widget's one server entry point. Auth-gated (the widget only
 * mounts inside the app shell), metered like every other AI call, and the
 * sole writer to the deny-all feedback_submissions table. The agent's
 * internal summary is stored but never returned to the client.
 */

const MAX_MESSAGES = 16;
const MAX_MESSAGE_CHARS = 2000;

export type FeedbackTurnResult =
  | {
      ok: true;
      reply: string;
      /** The submission was logged; the widget shows its done state. */
      logged: boolean;
    }
  | { ok: false; message: string };

export async function sendFeedbackTurn(args: {
  tab: "ask" | "suggest";
  kind?: FeedbackKind;
  messages: FeedbackMessage[];
}): Promise<FeedbackTurnResult> {
  const [user, { activeOrg }] = await Promise.all([getAuthUser(), getOrgContext()]);
  if (!user || !activeOrg) return { ok: false, message: "Please sign in again." };

  // Shape + size guards: the transcript is client-held, so never trust it.
  const messages = (Array.isArray(args.messages) ? args.messages : [])
    .filter(
      (m): m is FeedbackMessage =>
        !!m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0,
    )
    .slice(-MAX_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }));
  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return { ok: false, message: "Type a message first." };
  }

  // Same monthly AI cap as the assistant (bonus queries included).
  const cap = await checkQueryCap(activeOrg.id);
  if (!cap.allowed) {
    return {
      ok: false,
      message:
        "Your workspace has reached this month's AI limit. The widget will be back next month.",
    };
  }

  try {
    const turn = await runFeedbackTurn(
      { messages, tab: args.tab, kind: args.kind },
      {
        chat: chatCompletion,
        onUsage: (model, usage) =>
          recordUsage(activeOrg.id, user.id, model, mapDeepSeekUsage(usage)),
      },
    );

    if (turn.action === "finalize" && turn.kind && turn.summary) {
      const admin = createAdminClient();
      const lastUser = [...messages].reverse().find((m) => m.role === "user");
      const { error } = await admin.from("feedback_submissions").insert({
        org_id: activeOrg.id,
        user_id: user.id,
        kind: turn.kind,
        severity: turn.severity ?? "minor",
        user_text: lastUser?.content ?? "",
        transcript: messages,
        ai_summary: turn.summary,
        recommended_reward: turn.recommended_reward ?? "none",
      });
      if (error) {
        logger.error("feedback.insert_failed", { org_id: activeOrg.id, error: error.message });
        return {
          ok: false,
          message: "Couldn't save that submission. Please try again in a moment.",
        };
      }
      return { ok: true, reply: turn.reply, logged: true };
    }

    return { ok: true, reply: turn.reply, logged: false };
  } catch (err) {
    logger.error("feedback.turn_failed", { org_id: activeOrg.id, err });
    return { ok: false, message: "The assistant is unavailable right now. Please try again." };
  }
}
