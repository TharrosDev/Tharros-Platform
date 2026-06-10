import { redirect } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { SchedulingSetupWizard } from "@/components/scheduling/setup/setup-wizard";
import { getOrgContext } from "@/lib/org/queries";
import { getSchedulingSetup, getSchedulingStatus } from "@/lib/scheduling/queries";

/**
 * Day 43 — scheduling setup wizard. Subscription-gated by the parent
 * (subscribed) layout. The wizard stays reachable after onboarding so the owner
 * can edit any of it: when already set up we prefill the wizard with the saved
 * settings (the `complete_scheduling_setup` RPC is idempotent, so re-saving
 * updates in place rather than duplicating).
 */
export default async function SchedulingSetupPage() {
  const { activeOrg } = await getOrgContext();
  if (!activeOrg) redirect("/dashboard");

  const { onboardedAt } = await getSchedulingStatus(activeOrg.id);
  const editing = Boolean(onboardedAt);
  const initialState = editing ? await getSchedulingSetup(activeOrg.id) : undefined;

  return (
    <div className="space-y-8">
      <PageHeader
        title={editing ? "Edit scheduling setup" : "Set up scheduling"}
        description={
          editing
            ? "Update your team, hours, staffing, labor rules, or assistant voice. Jump to any step and save your changes."
            : "A few quick questions so the assistant can build schedules that fit your business. You can change any of this later."
        }
      />
      <SchedulingSetupWizard initialState={initialState} editing={editing} />
    </div>
  );
}
