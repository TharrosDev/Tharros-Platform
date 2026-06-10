import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlarmClock, CalendarX2, GaugeCircle, Repeat2, TriangleAlert, Users } from "lucide-react";

import { getOrgContext } from "@/lib/org/queries";
import { getSchedulingStatus } from "@/lib/scheduling/queries";
import {
  getEmployeeAnalytics,
  getOrgAnalytics,
  resolveWindow,
  ANALYTICS_WINDOWS,
} from "@/lib/analytics/queries";
import { formatPercent, reliabilityBand } from "@/lib/analytics/metrics";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
  const [org, employees] = await Promise.all([
    getOrgAnalytics(activeOrg.id, days),
    getEmployeeAnalytics(activeOrg.id, days),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Scheduling analytics"
        description={`Workforce oversight over the last ${days} days — coverage, reliability, and disruption.`}
      />

      <div className="flex items-center gap-2" role="group" aria-label="Time window">
        {ANALYTICS_WINDOWS.map((w) => (
          <Link
            key={w}
            href={`/scheduling/analytics?days=${w}`}
            aria-current={w === days ? "page" : undefined}
            className={buttonVariants({ variant: w === days ? "default" : "outline", size: "sm" })}
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

      <section className="space-y-3">
        <h2 className="type-h2">By employee</h2>
        {employees.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No employees on the roster yet. Add your team to see per-person analytics.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead className="text-right">Shifts</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead className="text-right">Reliability</TableHead>
                  <TableHead className="text-right">Sick calls</TableHead>
                  <TableHead className="text-right">Acceptance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((e) => (
                  <TableRow key={e.employeeId}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/scheduling/employees/${e.employeeId}`}
                        className="hover:underline"
                      >
                        {e.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{e.assignedShifts}</TableCell>
                    <TableCell className="text-right tabular-nums">{e.assignedHours}</TableCell>
                    <TableCell className="text-right">
                      <ReliabilityCell rate={e.reliability} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{e.sickCalls}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPercent(e.acceptanceRate)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}

const BAND_VARIANT = {
  good: "secondary",
  watch: "outline",
  poor: "destructive",
  none: "outline",
} as const;

function ReliabilityCell({ rate }: { rate: number | null }) {
  const band = reliabilityBand(rate);
  if (band === "none") return <span className="text-muted-foreground">—</span>;
  return <Badge variant={BAND_VARIANT[band]}>{formatPercent(rate)}</Badge>;
}
