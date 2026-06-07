"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/org/queries";
import { getAuthUser } from "@/lib/auth/current-user";
import { recordUsage } from "@/lib/billing/usage";
import { chatCompletion } from "@/lib/deepseek/client";
import { SCHEDULING_MODEL_PRO } from "@/lib/deepseek/models";
import { mapDeepSeekUsage } from "@/lib/deepseek/usage";
import { logger } from "@/lib/observability/logger";

import { translateIntent, type IntentTranslation } from "./intent";

/**
 * Day 47 — manager-side intent translation. Resolves the roster (for name → id),
 * runs the DeepSeek intent agent over the manager's plain-language goals, and
 * returns the structured solver inputs. NOT persisted — the Day-48 orchestrator
 * consumes the result (weights + per-employee hour targets it applies directly,
 * plus directives it interprets). Meters into `ai_usage_events` like every AI call.
 */

export type IntentState =
  | { ok: true; result: IntentTranslation }
  | { ok: false; message: string };

export async function translateSchedulingIntent(text: string): Promise<IntentState> {
  const goals = text.trim();
  if (!goals) return { ok: false, message: "Describe what you'd like the schedule to do." };

  const [user, { activeOrg }] = await Promise.all([getAuthUser(), getOrgContext()]);
  if (!user || !activeOrg) return { ok: false, message: "Not authenticated." };

  const supabase = await createClient();
  const { data: roster } = await supabase
    .from("employees")
    .select("id, name")
    .eq("org_id", activeOrg.id)
    .eq("active", true);

  try {
    const result = await translateIntent(
      { text: goals, roster: (roster ?? []) as Array<{ id: string; name: string }> },
      {
        chat: chatCompletion,
        model: SCHEDULING_MODEL_PRO,
        onUsage: (model, usage) => recordUsage(activeOrg.id, user.id, model, mapDeepSeekUsage(usage)),
      },
    );
    return { ok: true, result };
  } catch (err) {
    logger.error("translateSchedulingIntent: failed", { err, orgId: activeOrg.id });
    return { ok: false, message: "Couldn't interpret that just now. Please try rephrasing." };
  }
}
