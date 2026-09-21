import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getOrgContext } from "@/lib/org/queries";
import { getRoster } from "@/lib/employees/queries";
import { getSchedulingStatus } from "@/lib/scheduling/queries";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmployeeForm } from "@/components/employees/employee-form";
import { EmployeeRoster } from "@/components/employees/employee-roster";

export const metadata: Metadata = { title: "Team" };

/**
 * Day 52 — roster home (moved into the scheduling product). Add / remove
 * employees, send portal links, and open each person's profile. Subscription
 * gated by the parent layout; scheduling-setup gated here.
 */
export default async function SchedulingEmployeesPage() {
  const { activeOrg } = await getOrgContext();
  if (!activeOrg) redirect("/dashboard");

  const { onboardedAt } = await getSchedulingStatus(activeOrg.id);
  if (!onboardedAt) redirect("/scheduling/setup");

  const roster = await getRoster();
  const canManage = roster.viewerRole === "owner" || roster.viewerRole === "admin";

  return (
    <div className="space-y-8">
      <PageHeader
        title="Employees"
        description="Your scheduling roster. Open a profile to set employment details, role certifications, and availability."
      />

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Add an employee</CardTitle>
            <CardDescription>
              Add a team member, then open their profile to set scheduling details, or send a portal
              link so they can set their own availability.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EmployeeForm />
          </CardContent>
        </Card>
      ) : null}

      <EmployeeRoster employees={roster.employees} canManage={canManage} />
    </div>
  );
}
