import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { getOrgContext } from "@/lib/org/queries";
import {
  getEmployeeAttendance,
  getEmployeeHours,
  getEmployeeProfile,
} from "@/lib/employees/queries";
import {
  getEmployeeAvailability,
  getRoleCertifications,
  getSchedulingStatus,
} from "@/lib/scheduling/queries";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { EmployeeProfile } from "@/components/scheduling/employees/employee-profile";

export const metadata: Metadata = { title: "Employee profile" };

export default async function EmployeeProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ activeOrg }, { id }] = await Promise.all([getOrgContext(), params]);
  if (!activeOrg) redirect("/dashboard");

  const { onboardedAt } = await getSchedulingStatus(activeOrg.id);
  if (!onboardedAt) redirect("/scheduling/setup");

  const profile = await getEmployeeProfile(id);
  if (!profile) notFound();

  const canManage = activeOrg.role === "owner" || activeOrg.role === "admin";
  const [hours, attendance, catalog, availability] = await Promise.all([
    getEmployeeHours(id),
    getEmployeeAttendance(id),
    getRoleCertifications(activeOrg.id),
    getEmployeeAvailability(id),
  ]);

  const availableDays = availability.permanent.filter((p) => p.is_available).length;

  return (
    <div className="space-y-8">
      <PageHeader
        title={profile.name}
        description={profile.email}
        actions={
          <Link href="/scheduling/employees" className={buttonVariants({ variant: "outline" })}>
            Back to team
          </Link>
        }
      />
      <EmployeeProfile
        profile={profile}
        catalog={catalog}
        hours={hours}
        attendance={attendance}
        availableDays={availableDays}
        canManage={canManage}
      />
    </div>
  );
}
