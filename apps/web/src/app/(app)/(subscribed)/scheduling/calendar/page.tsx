import { redirect } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { ScheduleCalendar } from "@/components/scheduling/calendar/schedule-calendar";
import { getOrgContext } from "@/lib/org/queries";
import { getRoster } from "@/lib/employees/queries";
import {
  getLatestDraftSchedule,
  getRoleCertifications,
  getScheduleShifts,
  getSchedulingStatus,
  getScheduleValidationContext,
  type CalendarShift,
} from "@/lib/scheduling/queries";
import type { ValidationContext } from "@/lib/scheduling/validation";

/**
 * Day 50 — schedule calendar. Renders the latest draft as a two-week grid with
 * manual edit tools (assign, retime, add, delete, lock) that re-validate against
 * the org's labor + availability + role constraints live on every change.
 * Subscription gated by the parent layout; scheduling-setup gated here.
 */
export default async function ScheduleCalendarPage() {
  const { activeOrg } = await getOrgContext();
  if (!activeOrg) redirect("/dashboard");

  const { onboardedAt } = await getSchedulingStatus(activeOrg.id);
  if (!onboardedAt) redirect("/scheduling/setup");

  const [roster, schedule, roles] = await Promise.all([
    getRoster(),
    getLatestDraftSchedule(activeOrg.id),
    getRoleCertifications(activeOrg.id),
  ]);
  const canManage = roster.viewerRole === "owner" || roster.viewerRole === "admin";

  let shifts: CalendarShift[] = [];
  let validation: ValidationContext | null = null;
  if (schedule) {
    [shifts, validation] = await Promise.all([
      getScheduleShifts(schedule.id),
      getScheduleValidationContext(activeOrg.id, schedule.periodStart, schedule.periodEnd),
    ]);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Schedule"
        description="Review and adjust the draft. Edits are checked against your rules as you make them."
      />
      <ScheduleCalendar
        schedule={schedule}
        shifts={shifts}
        employees={roster.employees.map((e) => ({ id: e.id, name: e.name }))}
        roles={roles}
        validation={validation}
        canManage={canManage}
      />
    </div>
  );
}
