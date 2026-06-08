"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { acceptOffer, declineOffer } from "@/lib/scheduling/replacement";

import { getPortalSession } from "./session";

/**
 * Day 55 — the portal accept/decline actions for a replacement offer. The employee
 * is auth-light: identity comes from the validated cookie session, and the work runs
 * on the service-role admin client scoped to that session's employee + org (the
 * Day-45/54 pattern). The accept goes through the atomic `claim_replacement_offer`
 * RPC (first-accept-wins). Thin wrappers — the testable logic lives in
 * `lib/scheduling/replacement`.
 */

const INACTIVE = "This link isn't active anymore. Ask your manager for a fresh one.";

export type AcceptReplacementResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function acceptReplacement(offerId: string): Promise<AcceptReplacementResult> {
  const session = await getPortalSession();
  if (!session) return { ok: false, message: INACTIVE };
  if (!offerId || typeof offerId !== "string") {
    return { ok: false, message: "Pick the shift you want to take." };
  }

  const admin = createAdminClient();
  const result = await acceptOffer(admin, {
    offerId,
    employeeId: session.employeeId,
    orgId: session.orgId,
  });

  revalidatePath("/portal/schedule");
  if (result.ok) {
    return { ok: true, message: "You're on — the shift is now yours." };
  }
  return { ok: false, message: result.message };
}

export type DeclineReplacementResult = { ok: boolean };

export async function declineReplacement(offerId: string): Promise<DeclineReplacementResult> {
  const session = await getPortalSession();
  if (!session) return { ok: false };
  if (!offerId || typeof offerId !== "string") return { ok: false };

  const admin = createAdminClient();
  const result = await declineOffer(admin, {
    offerId,
    employeeId: session.employeeId,
    orgId: session.orgId,
  });
  revalidatePath("/portal/schedule");
  return result;
}
