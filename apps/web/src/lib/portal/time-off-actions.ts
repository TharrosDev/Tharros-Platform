"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { recordUsage } from "@/lib/billing/usage";
import { chatCompletion } from "@/lib/deepseek/client";
import { SCHEDULING_MODEL } from "@/lib/deepseek/models";
import { mapDeepSeekUsage } from "@/lib/deepseek/usage";
import { processTimeOffRequest } from "@/lib/scheduling/time-off";

import { getPortalSession } from "./session";

/**
 * Day 57 — the portal time-off action. The employee is auth-light: identity comes
 * from the validated cookie session, and the orchestration runs on the service-role
 * admin client scoped to that session's employee + org (the Day-45 pattern). The
 * DeepSeek recommendation is best-effort and metered into `ai_usage_events`; a missing
 * key / failed call falls back to a deterministic message so a request is never
 * blocked. Thin wrapper — the testable orchestration lives in `lib/scheduling/time-off`.
 */

const INACTIVE = "This link isn't active anymore. Ask your manager for a fresh one.";

export type RequestTimeOffResult = { ok: true; message: string } | { ok: false; message: string };

export async function requestTimeOff(
  startDate: string,
  endDate: string,
  reason?: string,
): Promise<RequestTimeOffResult> {
  const session = await getPortalSession();
  if (!session) return { ok: false, message: INACTIVE };

  if (!startDate || !endDate) {
    return { ok: false, message: "Pick a start and end date for your time off." };
  }

  const admin = createAdminClient();
  const result = await processTimeOffRequest(
    admin,
    {
      employeeId: session.employeeId,
      orgId: session.orgId,
      employeeName: session.employeeName,
      startDate,
      endDate,
      reasonText: reason,
    },
    {
      chat: chatCompletion,
      model: SCHEDULING_MODEL,
      onUsage: (model, usage) => recordUsage(session.orgId, null, model, mapDeepSeekUsage(usage)),
    },
  );

  if (result.ok) {
    revalidatePath("/portal/schedule");
    return { ok: true, message: result.message };
  }
  return { ok: false, message: result.message };
}
