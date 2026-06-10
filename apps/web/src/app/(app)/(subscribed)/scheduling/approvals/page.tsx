import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { ApprovalsInbox } from "@/components/scheduling/approvals/approvals-inbox";
import { getOrgContext } from "@/lib/org/queries";
import { getRoster } from "@/lib/employees/queries";
import {
  getEscalatedReplacements,
  getEscalatedSwaps,
  getSchedulingStatus,
} from "@/lib/scheduling/queries";
import { getPendingTimeOff } from "@/lib/scheduling/time-off";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Approvals" };

/**
 * The scheduling approvals inbox: every decision waiting on a manager in one
 * place — escalated shift swaps, pending time-off requests, and sick calls
 * whose replacement broadcast found no taker. Purely a new view over existing
 * data and the existing calendar actions; the calendar keeps its inline
 * panels for the same items.
 */
export default async function ApprovalsPage() {
  const { activeOrg } = await getOrgContext();
  if (!activeOrg) redirect("/dashboard");

  const { onboardedAt } = await getSchedulingStatus(activeOrg.id);
  if (!onboardedAt) redirect("/scheduling/setup");

  const roster = await getRoster();
  const canManage = roster.viewerRole === "owner" || roster.viewerRole === "admin";

  if (!canManage) {
    return (
      <>
        <PageHeader
          title="Approvals"
          description="Swap requests, time off, and unfilled shifts that need a manager."
        />
        <p className="text-muted-foreground type-body">
          Approvals are handled by your organization&apos;s owners and admins.
        </p>
      </>
    );
  }

  const [swaps, timeOff, replacements] = await Promise.all([
    getEscalatedSwaps(activeOrg.id),
    getPendingTimeOff(createAdminClient(), activeOrg.id),
    getEscalatedReplacements(activeOrg.id),
  ]);

  return (
    <>
      <PageHeader
        title="Approvals"
        description="Everything waiting on your call, in one place. The agent handles the rest."
      />
      <ApprovalsInbox
        swaps={swaps}
        timeOff={timeOff.filter((t) => t.status === "pending")}
        replacements={replacements}
      />
    </>
  );
}
