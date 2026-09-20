import { redirect } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { AvailabilityManager } from "@/components/scheduling/availability/availability-manager";
import { getOrgContext } from "@/lib/org/queries";
import { getRoster } from "@/lib/employees/queries";
import { getEmployeeAvailability, getSchedulingStatus } from "@/lib/scheduling/queries";

export const metadata = { title: "Availability" };

/**
 * Day 44 — manager availability surface. Pick a team member (via ?employee=),
 * then edit their permanent weekly availability + dated overrides. Subscription
 * gated by the parent layout; scheduling-setup gated here.
 */
export default async function AvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ employee?: string }>;
}) {
  const [{ activeOrg }, { employee: selectedId }] = await Promise.all([
    getOrgContext(),
    searchParams,
  ]);
  if (!activeOrg) redirect("/dashboard");

  const { onboardedAt } = await getSchedulingStatus(activeOrg.id);
  if (!onboardedAt) redirect("/scheduling/setup");

  const roster = await getRoster();
  const canManage = roster.viewerRole === "owner" || roster.viewerRole === "admin";
  const selected = roster.employees.find((e) => e.id === selectedId) ?? null;
  const availability = selected ? await getEmployeeAvailability(selected.id) : null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Availability"
        description="Set when each team member can work. The scheduler only assigns shifts inside these times."
      />
      <AvailabilityManager
        employees={roster.employees.map((e) => ({ id: e.id, name: e.name, email: e.email }))}
        selectedId={selected?.id ?? null}
        selectedName={selected?.name ?? null}
        availability={availability}
        canManage={canManage}
      />
    </div>
  );
}
