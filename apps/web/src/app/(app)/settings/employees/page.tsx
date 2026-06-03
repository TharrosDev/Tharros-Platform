import type { Metadata } from "next";

import { getAuthUser } from "@/lib/auth/current-user";
import { getRoster } from "@/lib/employees/queries";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmployeeForm } from "@/components/employees/employee-form";
import { EmployeeRoster } from "@/components/employees/employee-roster";

export const metadata: Metadata = { title: "Employees" };

export default async function EmployeesPage() {
  const [user, roster] = await Promise.all([getAuthUser(), getRoster()]);

  if (!user || !roster.activeOrg) {
    return (
      <>
        <PageHeader title="Employees" description="Manage your scheduling roster." />
        <p className="text-muted-foreground type-body">
          Select or create an organization to manage its employees.
        </p>
      </>
    );
  }

  const canManage = roster.viewerRole === "owner" || roster.viewerRole === "admin";

  return (
    <>
      <PageHeader
        title="Employees"
        description={`Your scheduling roster for ${roster.activeOrg.name}. Send each employee a personal portal link — no account needed on their end.`}
      />

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Add an employee</CardTitle>
            <CardDescription>
              Add a team member, then send them a portal link to set their availability and
              see their schedule.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EmployeeForm />
          </CardContent>
        </Card>
      ) : null}

      <EmployeeRoster employees={roster.employees} canManage={canManage} />
    </>
  );
}
