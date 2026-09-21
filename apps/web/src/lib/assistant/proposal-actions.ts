"use server";

import { revalidatePath } from "next/cache";

import { getAuthUser } from "@/lib/auth/current-user";
import { getFeatureAccess } from "@/lib/billing/entitlements";
import { checkQueryCap } from "@/lib/billing/usage";
import { updateLeadStatus } from "@/lib/leads/actions";
import { generateLeadFollowUpDraft } from "@/lib/leads/follow-up";
import { createNotification } from "@/lib/notifications/notify";
import { logger } from "@/lib/observability/logger";
import { getOrgContext } from "@/lib/org/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ProposalView } from "@/lib/assistant/types";

type Result = { status: ProposalView["status"]; error?: string };

/**
 * Apply a change the assistant proposed. Runs as the confirming user through
 * the same actions/checks the rest of the app uses; the pending → confirmed
 * claim is atomic so a double click can't apply it twice.
 */
export async function confirmProposal(id: string): Promise<Result> {
  const [user, { activeOrg }] = await Promise.all([getAuthUser(), getOrgContext()]);
  if (!user || !activeOrg) return { status: "pending", error: "Please sign in again." };

  // RLS read proves the caller belongs to the proposal's org.
  const supabase = await createClient();
  const { data: proposal } = await supabase
    .from("assistant_proposals")
    .select("id, kind, payload, status")
    .eq("id", id)
    .eq("org_id", activeOrg.id)
    .maybeSingle();
  if (!proposal) return { status: "failed", error: "Proposal not found." };
  if (proposal.status !== "pending") return { status: proposal.status };

  const admin = createAdminClient();
  const { data: claimed } = await admin
    .from("assistant_proposals")
    .update({ status: "confirmed", decided_by: user.id, decided_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (!claimed) return { status: "confirmed" };

  const payload = proposal.payload as Record<string, string>;
  try {
    if (proposal.kind === "lead_status") {
      const fd = new FormData();
      fd.set("leadId", payload.leadId);
      fd.set("status", payload.status);
      // Enforces the Leads entitlement and records the status-change event
      // (which also fires any matching automations).
      await updateLeadStatus(fd);
    } else if (proposal.kind === "follow_up_draft") {
      if (!(await getFeatureAccess("leads")).entitled) throw new Error("Leads isn't on your plan.");
      if (!(await checkQueryCap(activeOrg.id)).allowed) {
        throw new Error("This month's AI query limit is reached.");
      }
      await generateLeadFollowUpDraft({
        orgId: activeOrg.id,
        leadId: payload.leadId,
        userId: user.id,
      });
    } else if (proposal.kind === "notify_team") {
      if (activeOrg.role !== "owner" && activeOrg.role !== "admin") {
        throw new Error("Only owners and admins can notify the team.");
      }
      const { data: managers } = await admin
        .from("memberships")
        .select("user_id")
        .eq("org_id", activeOrg.id)
        .in("role", ["owner", "admin"]);
      await Promise.all(
        (managers ?? []).map((m) =>
          createNotification(admin, {
            orgId: activeOrg.id,
            userId: String(m.user_id),
            type: "system",
            title: "Message from the assistant",
            body: payload.message,
            data: {},
          }),
        ),
      );
    }
  } catch (err) {
    // updateLeadStatus signals failure via redirect(); treat any throw as failed.
    logger.warn("assistant.proposal_failed", { proposal_id: id, err });
    await admin.from("assistant_proposals").update({ status: "failed" }).eq("id", id);
    return { status: "failed", error: err instanceof Error ? err.message : undefined };
  }

  revalidatePath("/assistant");
  return { status: "confirmed" };
}

export async function dismissProposal(id: string): Promise<Result> {
  const [user, { activeOrg }] = await Promise.all([getAuthUser(), getOrgContext()]);
  if (!user || !activeOrg) return { status: "pending", error: "Please sign in again." };
  const supabase = await createClient();
  const { data: proposal } = await supabase
    .from("assistant_proposals")
    .select("id")
    .eq("id", id)
    .eq("org_id", activeOrg.id)
    .maybeSingle();
  if (!proposal) return { status: "failed", error: "Proposal not found." };
  await createAdminClient()
    .from("assistant_proposals")
    .update({ status: "dismissed", decided_by: user.id, decided_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending");
  return { status: "dismissed" };
}
