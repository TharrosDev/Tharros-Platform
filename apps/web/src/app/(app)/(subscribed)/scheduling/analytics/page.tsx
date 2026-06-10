import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlarmClock, CalendarX2, GaugeCircle, Repeat2, TriangleAlert, Users } from "lucide-react";

import { getOrgContext } from "@/lib/org/queries";
import { getSchedulingStatus } from "@/lib/scheduling/queries";
import {
  getDailyStaffedHours,
  getEmployeeAnalytics,
  getOrgAnalytics,
  resolveWindow,
  ANALYTICS_WINDOWS,
} from "@/lib/analytics/queries";
import { formatPercent } from "@/lib/analytics/metrics";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { BarStrip } from "@/components/charts/bar-strip";
import { EmployeeAnalyticsTable } from "@/components/analytics/employee-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Scheduling analytics" };

/**
 * Day 59 — scheduling analytics dashboard. Org-wide oversight metrics (labor
 * utilization, schedule efficiency, staffing gap, replacement acceptance, call-out
 * frequency) plus a per-employee table (hours, reliability, acceptance). Reads two
 * member-readable SECURITY DEFINER RPCs; derived scores are computed in pure TS.
 * The trailing window (7 / 30 / 90 days) is a `?days=` query param.
 */
export default async function SchedulingAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const [{ activeOrg }, sp] = await Promise.all([getOrgContext(), searchParams]);
  if (!activeOrg) redirect("/dashboard");

  const { onboardedAt } = await getSchedulingStatus(activeOrg.id);
  if (!onboardedAt) redirect("/scheduling/setup");

  const days = resolveWindow(sp.days);
  const [org, employees, dailyHours] = await Promise.all([
    getOrgAnalytics(activeOrg.id, days),
    getEmployeeAnalytics(activeOrg.id, days),
    getDailyStaffedHours(activeOrg.id, days),
  ]);
  const totalStaffedHours = Math.round(dailyHours.reduce((sum, d) => sum + d.hours, 0));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Scheduling analytics"
        description={`Workforce oversight over the last ${days} days — coverage, reliability, and disruption.`}
      />

      <div
        className="bg-muted inline-flex items-center gap-1 rounded-lg p-1"
        role="group"
        aria-label="Time window"
      >
        {ANALYTICS_WINDOWS.map((w) => (
          <Link
            key={w}
            href={`/scheduling/analytics?days=${w}`}
            aria-current={w === days ? "page" : undefined}
            className={cn(
              "focus-visible:ring-ring/40 rounded-md px-3 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px]",
              w === days
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {w} days
          </Link>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          icon={<GaugeCircle />}
          label="Labor utilization"
          value={formatPercent(org.laborUtilization)}
          hint={`${org.assignedHours}h staffed of ${org.assignedHours + org.openHours}h scheduled`}
        />
        <StatCard
          icon={<CalendarX2 />}
          label="Schedule efficiency"
          value={formatPercent(org.scheduleEfficiency)}
          hint={`${org.assignedShifts} of ${org.totalShifts} shifts filled`}
        />
        <StatCard
          icon={<TriangleAlert />}
          label="Staffing gap"
          value={String(org.staffingGap.openShifts)}
          hint={`${org.staffingGap.openHours}h across open shifts`}
        />
        <StatCard
          icon={<Repeat2 />}
          label="Replacement acceptance"
          value={formatPercent(org.acceptanceRate)}
          hint="Offers accepted of offers sent"
        />
        <StatCard
          icon={<AlarmClock />}
          label="Sick calls"
          value={String(org.sickCalls)}
          hint={`${org.swaps} swaps · ${org.timeOff} time-off requests`}
        />
        <StatCard
          icon={<Users />}
          label="People scheduled"
          value={String(employees.filter((e) => e.assignedShifts > 0).length)}
          hint={`${employees.length} on the roster`}
        />
      </div>

      {dailyHours.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Staffed hours by day</CardTitle>
            <CardDescription>
              {totalStaffedHours}h staffed over the last {days} days
              {org.acceptanceRate !== null
                ? `, with ${formatPercent(org.acceptanceRate)} of replacement offers accepted`
                : ""}
              .
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BarStrip
              points={dailyHours.map((d) => ({ label: d.date, value: d.hours }))}
              unit="h"
            />
            <div className="text-muted-foreground mt-1 flex justify-between text-xs tabular-nums">
              <span>{dailyHours[0].date}</span>
              <span>{dailyHours[dailyHours.length - 1].date}</span>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <section className="space-y-3">
        <h2 className="type-h2">By employee</h2>
        {employees.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No employees on the roster yet. Add your team to see per-person analytics.
          </p>
        ) : (
          <EmployeeAnalyticsTable employees={employees} />
        )}
      </section>
    </div>
  );
}
