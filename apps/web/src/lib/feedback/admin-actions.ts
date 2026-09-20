"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/auth/current-user";
import { isPlatformAdmin } from "@/lib/auth/admin";
import { currentUsagePeriodStart } from "@/lib/billing/usage-math";
import { logger } from "@/lib/observability/logger";

/**
 * Platform-admin actions over the deny-all feedback tables. Every entry point
 * re-checks the email allowlist server-side; the admin client is the only
 * reader/writer these tables have.
 */

const ADMIN_PATH = "/admin/feedback";
const MAX_BONUS_QUERIES = 5000;

type AdminActionResult = { ok: true } | { ok: false; message: string };

async function requirePlatformAdmin(): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await getAuthUser();
  if (!user || !isPlatformAdmin(user.email)) {
    return { ok: false, message: "Not authorized." };
  }
  return { ok: true };
}

/** Approve a submission with a usage bonus for the org's current month. */
export async function approveUsageBonus(args: {
  submissionId: string;
  queries: number;
}): Promise<AdminActionResult> {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth;

  const queries = Math.floor(Number(args.queries));
  if (!Number.isFinite(queries) || queries <= 0 || queries > MAX_BONUS_QUERIES) {
    return { ok: false, message: `Bonus must be between 1 and ${MAX_BONUS_QUERIES} queries.` };
  }

  const admin = createAdminClient();
  const { data: submission, error: readErr } = await admin
    .from("feedback_submissions")
    .select("id, org_id, reward_status")
    .eq("id", args.submissionId)
    .maybeSingle();
  if (readErr || !submission) return { ok: false, message: "Submission not found." };
  if (submission.reward_status !== "pending") {
    return { ok: false, message: "This submission was already decided." };
  }

  const month = currentUsagePeriodStart().toISOString().slice(0, 10);
  const { error: bonusErr } = await admin.from("usage_bonuses").insert({
    org_id: submission.org_id,
    submission_id: submission.id,
    queries,
    month,
  });
  if (bonusErr) {
    logger.error("feedback.bonus_insert_failed", {
      submissionId: args.submissionId,
      error: bonusErr.message,
    });
    return { ok: false, message: "Couldn't record the bonus. Please try again." };
  }

  const { error: updateErr } = await admin
    .from("feedback_submissions")
    .update({
      reward_status: "approved",
      status: "reviewed",
      reward_note: `+${queries} AI queries for ${month.slice(0, 7)}`,
      updated_at: new Date().toISOString(),
    })
    .eq("id", submission.id);
  if (updateErr) {
    logger.error("feedback.approve_update_failed", {
      submissionId: args.submissionId,
      error: updateErr.message,
    });
    return {
      ok: false,
      message: "Bonus recorded, but the submission didn't update. Refresh and check.",
    };
  }

  revalidatePath(ADMIN_PATH);
  return { ok: true };
}

/** Close a submission without a reward (deny) or simply mark it reviewed. */
export async function resolveSubmission(args: {
  submissionId: string;
  decision: "denied" | "reviewed";
}): Promise<AdminActionResult> {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminClient();
  const patch =
    args.decision === "denied"
      ? { reward_status: "denied", status: "reviewed", updated_at: new Date().toISOString() }
      : { status: "reviewed", updated_at: new Date().toISOString() };
  const { error } = await admin
    .from("feedback_submissions")
    .update(patch)
    .eq("id", args.submissionId);
  if (error) {
    logger.error("feedback.resolve_failed", {
      submissionId: args.submissionId,
      error: error.message,
    });
    return { ok: false, message: "Couldn't update the submission. Please try again." };
  }

  revalidatePath(ADMIN_PATH);
  return { ok: true };
}
