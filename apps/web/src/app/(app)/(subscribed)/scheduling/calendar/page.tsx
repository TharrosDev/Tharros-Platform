import { redirect } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { ScheduleCalendar } from "@/components/scheduling/calendar/schedule-calendar";
import { getOrgContext } from "@/lib/org/queries";
import { getRoster } from "@/lib/employees/queries";
import {
  getLatestSchedule,
  getRoleCertifications,
  getScheduleAuditTrail,
  getScheduleShifts,
  getSchedulingStatus,
  getScheduleValidationContext,
  type AuditEntry,
  type CalendarShift,
} from "@/lib/scheduling/queries";
import type { ValidationContext } from "@/lib/scheduling/validation";

/**
 * Day 50/51 — schedule calendar. Renders the latest schedule as a two-week grid
 * with manual edit tools (assign, retime, add, delete, lock) that re-validate
 * against the org's labor + availability + role constraints live on every change,
 * plus the Day-51 approval/publish flow, reopen-to-edit, and change history.
 * Subscription gated by the parent layout; scheduling-setup gated here.
 */
export default async function ScheduleCalendarPage() {
  const { activeOrg } = await getOrgContext();
  if (!activeOrg) redirect("/dashboard");

  const { onboardedAt } = await getSchedulingStatus(activeOrg.id);
  if (!onboardedAt) redirect("/scheduling/setup");

  const [roster, schedule, roles] = await Promise.all([
    getRoster(),
    getLatestSchedule(activeOrg.id),
    getRoleCertifications(activeOrg.id),
  ]);
  const canManage = roster.viewerRole === "owner" || roster.viewerRole === "admin";

  let shifts: CalendarShift[] = [];
  let validation: ValidationContext | null = null;
  let auditTrail: AuditEntry[] = [];
  if (schedule) {
    [shifts, validation, auditTrail] = await Promise.all([
      getScheduleShifts(schedule.id),
      getScheduleValidationContext(activeOrg.id, schedule.periodStart, schedule.periodEnd),
      getScheduleAuditTrail(schedule.id),
    ]);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Schedule"
        description="Review, adjust, and publish. Edits are checked against your rules as you make them."
      />
      <ScheduleCalendar
        schedule={schedule}
        shifts={shifts}
        employees={roster.employees.map((e) => ({ id: e.id, name: e.name }))}
        roles={roles}
        validation={validation}
        auditTrail={auditTrail}
        canManage={canManage}
      />
    </div>
  );
}
