import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getAuthUser } from "@/lib/auth/current-user";
import { isPlatformAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/page-header";
import {
  FeedbackReviewList,
  type ReviewSubmission,
} from "@/components/feedback/feedback-review-list";

export const metadata: Metadata = { title: "Feedback inbox" };

export const dynamic = "force-dynamic";

/**
 * Platform-admin review of feedback submissions across every org. Hidden
 * behind the email allowlist (a non-admin gets a 404, not a hint); all reads
 * go through the service-role client because the table is deny-all.
 */
export default async function AdminFeedbackPage() {
  const user = await getAuthUser();
  if (!user || !isPlatformAdmin(user.email)) notFound();

  const admin = createAdminClient();
  const { data } = await admin
    .from("feedback_submissions")
    .select(
      "id, org_id, user_id, kind, severity, user_text, ai_summary, recommended_reward, reward_status, reward_note, status, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = (data ?? []) as Array<Omit<ReviewSubmission, "orgName" | "submitterName">>;

  // Join org + submitter names in JS (no FK embeds across these tables).
  const orgIds = [...new Set(rows.map((r) => r.org_id))];
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const [{ data: orgRows }, { data: profileRows }] = await Promise.all([
    orgIds.length
      ? admin.from("organizations").select("id, name").in("id", orgIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
    userIds.length
      ? admin.from("profiles").select("id, full_name").in("id", userIds)
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null }> }),
  ]);
  const orgName = new Map(
    ((orgRows ?? []) as Array<{ id: string; name: string }>).map((o) => [o.id, o.name]),
  );
  const submitterName = new Map(
    ((profileRows ?? []) as Array<{ id: string; full_name: string | null }>).map((p) => [
      p.id,
      p.full_name,
    ]),
  );

  const submissions: ReviewSubmission[] = rows.map((r) => ({
    ...r,
    orgName: orgName.get(r.org_id) ?? "Unknown org",
    submitterName: submitterName.get(r.user_id) ?? null,
  }));

  return (
    <>
      <PageHeader
        title="Feedback inbox"
        description="Suggestions, bugs, and wishes from every workspace. Approve a usage bonus, or close without one."
      />
      <FeedbackReviewList submissions={submissions} />
    </>
  );
}
