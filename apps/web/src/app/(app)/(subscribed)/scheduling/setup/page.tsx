import { redirect } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { SchedulingSetupWizard } from "@/components/scheduling/setup/setup-wizard";
import { getOrgContext } from "@/lib/org/queries";
import { getSchedulingStatus } from "@/lib/scheduling/queries";

/**
 * Day 43 — scheduling setup wizard. Subscription-gated by the parent
 * (subscribed) layout. Once setup is complete we send the owner to /scheduling;
 * the wizard remains reachable from there to make edits.
 */
export default async function SchedulingSetupPage() {
  const { activeOrg } = await getOrgContext();
  if (!activeOrg) redirect("/dashboard");

  const { onboardedAt } = await getSchedulingStatus(activeOrg.id);
  if (onboardedAt) redirect("/scheduling");

  return (
    <div className="space-y-8">
      <PageHeader
        title="Set up scheduling"
        description="A few quick questions so the assistant can build schedules that fit your business. You can change any of this later."
      />
      <SchedulingSetupWizard />
    </div>
  );
}
