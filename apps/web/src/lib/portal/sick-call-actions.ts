"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { recordUsage } from "@/lib/billing/usage";
import { chatCompletion } from "@/lib/deepseek/client";
import { SCHEDULING_MODEL } from "@/lib/deepseek/models";
import { mapDeepSeekUsage } from "@/lib/deepseek/usage";
import { processSickCall } from "@/lib/scheduling/sick-call";

import { getPortalSession } from "./session";

/**
 * Day 54 — the portal sick-call action. The employee is auth-light: identity comes
 * from the validated cookie session, and the orchestration runs on the service-role
 * admin client scoped to that session's employee + org (the Day-45 pattern). The
 * DeepSeek confirmation is best-effort and metered into `ai_usage_events`; a missing
 * key / failed call falls back to a deterministic message so a call-out is never
 * blocked. Thin wrapper — the testable orchestration lives in `lib/scheduling/sick-call`.
 */

const INACTIVE = "This link isn't active anymore. Ask your manager for a fresh one.";

export type ReportSickCallResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function reportSickCall(
  shiftId: string,
  reasonText?: string,
): Promise<ReportSickCallResult> {
  const session = await getPortalSession();
  if (!session) return { ok: false, message: INACTIVE };

  if (!shiftId || typeof shiftId !== "string") {
    return { ok: false, message: "Pick the shift you can't make." };
  }

  const admin = createAdminClient();
  const result = await processSickCall(
    admin,
    {
      employeeId: session.employeeId,
      orgId: session.orgId,
      employeeName: session.employeeName,
      shiftId,
      reasonText,
    },
    {
      chat: chatCompletion,
      model: SCHEDULING_MODEL,
      onUsage: (model, usage) =>
        recordUsage(session.orgId, null, model, mapDeepSeekUsage(usage)),
    },
  );

  if (result.ok) {
    revalidatePath("/portal/schedule");
    return { ok: true, message: result.message };
  }
  return { ok: false, message: result.message };
}
