import { redirect } from "next/navigation";

import { getFeatureAccess } from "@/lib/billing/entitlements";
import { minTierForFeature } from "@/lib/billing/plans";
import { getOrgContext } from "@/lib/org/queries";
import { getRoster } from "@/lib/employees/queries";
import {
  getEscalatedReplacements,
  getEscalatedSwaps,
  getSchedulingStatus,
} from "@/lib/scheduling/queries";
import { getPendingTimeOff } from "@/lib/scheduling/time-off";
import { createAdminClient } from "@/lib/supabase/admin";
import { UpgradeGate } from "@/components/billing/upgrade-gate";
import { SchedulingSubnav } from "@/components/scheduling/subnav";

/**
 * Day 61 — feature gate for AI Workforce Scheduling. The parent (subscribed)
 * group already requires an active subscription; this adds the per-tier check:
 * scheduling is a team feature (Growth+), so a Starter org sees an upgrade prompt
 * instead of the product (`reason='not_in_plan'`). A missing subscription
 * (shouldn't reach here) falls back to /billing.
 *
 * Once entitled and set up, every scheduling page renders under the persistent
 * section rail (with a pending-approvals badge for managers). Before setup the
 * rail is hidden so the wizard stands alone.
 */
export default async function SchedulingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await getFeatureAccess("scheduling");

  if (!access.entitled) {
    if (access.reason === "no_subscription") redirect("/billing");
    const requiredPlan = minTierForFeature("scheduling");
    return (
      <UpgradeGate
        feature="Scheduling"
        requiredPlanName={requiredPlan?.name ?? "Growth"}
        blurb="Build conflict-free staff schedules with the AI workforce scheduler — availability collection, auto-generation, and disruption handling."
      />
    );
  }

  const { activeOrg } = await getOrgContext();
  const { onboardedAt } = activeOrg
    ? await getSchedulingStatus(activeOrg.id)
    : { onboardedAt: null };

  if (!activeOrg || !onboardedAt) return <>{children}</>;

  // Pending-approvals badge (managers only): escalated swaps + pending time
  // off + escalated replacements. Members see the rail without a count.
  const roster = await getRoster();
  const canManage = roster.viewerRole === "owner" || roster.viewerRole === "admin";
  let pendingApprovals = 0;
  if (canManage) {
    const [swaps, timeOff, replacements] = await Promise.all([
      getEscalatedSwaps(activeOrg.id),
      getPendingTimeOff(createAdminClient(), activeOrg.id),
      getEscalatedReplacements(activeOrg.id),
    ]);
    pendingApprovals =
      swaps.length + timeOff.filter((t) => t.status === "pending").length + replacements.length;
  }

  return (
    <div className="space-y-6">
      <SchedulingSubnav pendingApprovals={pendingApprovals} />
      {children}
    </div>
  );
}
