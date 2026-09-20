import { getOrgContext } from "@/lib/org/queries";
import { getSchedulingStatus } from "@/lib/scheduling/queries";
import { countPendingApprovals } from "@/lib/scheduling/pending-approvals";
import { FeatureGate } from "@/components/billing/feature-gate";
import { SchedulingSubnav } from "@/components/scheduling/subnav";

/**
 * Scheduling is Growth+, so the shared gate runs first. Once entitled and set
 * up, every page in the section renders under the persistent bay rail, with a
 * pending-approvals count for managers. Before setup the rail is hidden so the
 * wizard stands alone.
 */
export default async function SchedulingLayout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureGate feature="scheduling">
      <SchedulingFrame>{children}</SchedulingFrame>
    </FeatureGate>
  );
}

async function SchedulingFrame({ children }: { children: React.ReactNode }) {
  const { activeOrg } = await getOrgContext();
  const { onboardedAt } = activeOrg
    ? await getSchedulingStatus(activeOrg.id)
    : { onboardedAt: null };

  if (!activeOrg || !onboardedAt) return <>{children}</>;

  // Members see the rail without a count; only managers can act on approvals.
  const canManage = activeOrg.role === "owner" || activeOrg.role === "admin";
  const pendingApprovals = canManage ? await countPendingApprovals(activeOrg.id) : 0;

  return (
    <div className="space-y-6">
      <SchedulingSubnav pendingApprovals={pendingApprovals} />
      {children}
    </div>
  );
}
