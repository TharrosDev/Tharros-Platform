"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  proposeSwap as proposeSwapEngine,
  respondToSwap as respondToSwapEngine,
} from "@/lib/scheduling/swaps";

import { getPortalSession } from "./session";

/**
 * Day 56 — portal shift-swap actions. Auth-light: identity comes from the validated
 * cookie session; the work runs on the service-role admin client scoped to that
 * session's employee + org (the Day-54/55 pattern). Thin wrappers — the testable
 * orchestration lives in `lib/scheduling/swaps`.
 */

const INACTIVE = "This link isn't active anymore. Ask your manager for a fresh one.";

export type SwapActionResult = { ok: true; message: string } | { ok: false; message: string };

/** Propose a swap: trade (targetEmployeeId + targetShiftId), handoff (targetEmployeeId
 * only), or open offer (neither). */
export async function proposeSwap(input: {
  shiftId: string;
  targetEmployeeId?: string | null;
  targetShiftId?: string | null;
}): Promise<SwapActionResult> {
  const session = await getPortalSession();
  if (!session) return { ok: false, message: INACTIVE };
  if (!input.shiftId) return { ok: false, message: "Pick the shift you want to swap." };

  const admin = createAdminClient();
  const result = await proposeSwapEngine(admin, {
    orgId: session.orgId,
    requestingEmployeeId: session.employeeId,
    shiftId: input.shiftId,
    targetEmployeeId: input.targetEmployeeId ?? null,
    targetShiftId: input.targetShiftId ?? null,
  });
  if (!result.ok) return { ok: false, message: result.message };

  revalidatePath("/portal/schedule");
  return {
    ok: true,
    message: input.targetEmployeeId
      ? "Sent — your coworker will be asked to accept."
      : "Posted — any eligible coworker can pick it up.",
  };
}

/** Accept or decline a targeted proposal, or claim an open offer (accept = true). */
export async function respondToSwap(requestId: string, accept: boolean): Promise<SwapActionResult> {
  const session = await getPortalSession();
  if (!session) return { ok: false, message: INACTIVE };
  if (!requestId) return { ok: false, message: "Missing swap." };

  const admin = createAdminClient();
  const result = await respondToSwapEngine(admin, {
    orgId: session.orgId,
    requestId,
    claimantId: session.employeeId,
    accept,
  });

  revalidatePath("/portal/schedule");
  if (!result.ok) return { ok: false, message: result.message };
  const message =
    result.outcome === "applied"
      ? "Done — your schedule has been updated."
      : result.outcome === "escalated"
        ? "Sent to your manager for approval."
        : "Declined.";
  return { ok: true, message };
}
