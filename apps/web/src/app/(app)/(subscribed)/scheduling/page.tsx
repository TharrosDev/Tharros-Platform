import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CheckSquare } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getOrgContext } from "@/lib/org/queries";
import { getLatestSchedule, getSchedulingSummary } from "@/lib/scheduling/queries";
import { countPendingApprovals } from "@/lib/scheduling/pending-approvals";
import { getScheduleActivityPage } from "@/lib/audit/queries";
import { presentActivityFeed } from "@/lib/audit/present";
import { cn, formatDateRange } from "@/lib/utils";

/**
 * Scheduling overview: what needs the manager (linking to the Approvals
 * inbox), the current schedule, the setup summary and recent activity. Routes
 * to the setup wizard until setup completes.
 */
const PRESET_LABEL: Record<string, string> = {
  ontario: "Ontario (ESA)",
  canada_federal: "Canada (federal)",
  custom: "Custom",
};

const TONE_LABEL: Record<string, string> = {
  friendly: "Friendly",
  professional: "Professional",
  casual: "Casual",
  direct: "Direct",
};

const SCHEDULE_STATUS: Record<string, { label: string; variant: "default" | "success" }> = {
  draft: { label: "Draft", variant: "default" },
  published: { label: "Published", variant: "success" },
};

export default async function SchedulingPage() {
  const { activeOrg } = await getOrgContext();
  if (!activeOrg) redirect("/dashboard");

  const summary = await getSchedulingSummary(activeOrg.id);
  if (!summary.onboardedAt) redirect("/scheduling/setup");

  const canManage = activeOrg.role === "owner" || activeOrg.role === "admin";
  const [schedule, activityPage, pendingApprovals] = await Promise.all([
    getLatestSchedule(activeOrg.id),
    getScheduleActivityPage(activeOrg.id),
    canManage ? countPendingApprovals(activeOrg.id) : Promise.resolve(0),
  ]);
  const recentActivity = presentActivityFeed(activityPage.rows.slice(0, 6));
  const status = schedule ? SCHEDULE_STATUS[schedule.status] : null;

  const setup = [
    { label: "Team members", value: summary.employeeCount },
    { label: "Open days per week", value: summary.openDays },
    { label: "Labour rules", value: PRESET_LABEL[summary.preset] ?? summary.preset },
    { label: "Assistant voice", value: TONE_LABEL[summary.persona.tone] ?? summary.persona.tone },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Scheduling"
        description="The agent collects availability, drafts the schedule and handles disruptions. You approve."
        actions={
          <Link href="/scheduling/calendar" className={buttonVariants()}>
            Open schedule
          </Link>
        }
      />

      {canManage ? (
        <Link
          href="/scheduling/approvals"
          className="group bg-card focus-visible:ring-ring/40 flex items-center gap-4 rounded-xl border px-4 py-3.5 shadow-card outline-none transition-colors hover:bg-accent/40 focus-visible:ring-[3px] sm:px-5"
        >
          <span
            aria-hidden
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg [&>svg]:size-4",
              pendingApprovals > 0 ? "bg-warning/10 text-warning" : "bg-success/10 text-success",
            )}
          >
            <CheckSquare />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">
              {pendingApprovals > 0
                ? `${pendingApprovals} decision${pendingApprovals === 1 ? "" : "s"} waiting on you`
                : "Nothing needs your call"}
            </span>
            <span className="text-muted-foreground type-small block">
              {pendingApprovals > 0
                ? "Swaps, time off and unfilled shifts the agent flagged for a person."
                : "Anything the agent escalates lands in Approvals."}
            </span>
          </span>
          <ArrowRight
            className="text-muted-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </Link>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby="current-heading" className="min-w-0">
          <h2 id="current-heading" className="type-h2 mb-3">
            Current schedule
          </h2>
          <div className="bg-card rounded-xl border p-5 shadow-card">
            {schedule ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-lg font-semibold tracking-[-0.015em]">
                    {formatDateRange(schedule.periodStart, schedule.periodEnd)}
                  </p>
                  {status ? <Badge variant={status.variant}>{status.label}</Badge> : null}
                </div>
                <p className="text-muted-foreground type-small mt-1.5 max-w-prose">
                  {schedule.optimizationSummary ??
                    (schedule.status === "draft"
                      ? "Review the draft, fix anything flagged, then publish to your team."
                      : "Published to your team. Changes from here are tracked in the activity log.")}
                </p>
                <Link
                  href="/scheduling/calendar"
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-4")}
                >
                  {schedule.status === "draft" ? "Review draft" : "View schedule"}
                </Link>
              </>
            ) : (
              <>
                <p className="font-semibold">No schedule yet</p>
                <p className="text-muted-foreground type-small mt-1">
                  Generate a draft from the calendar. Nothing reaches your team until you publish it.
                </p>
                <Link
                  href="/scheduling/calendar"
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-4")}
                >
                  Generate a draft
                </Link>
              </>
            )}
          </div>
        </section>

        <section aria-labelledby="setup-heading">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="setup-heading" className="type-h2">
              Setup
            </h2>
            <Link href="/scheduling/setup" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Edit
            </Link>
          </div>
          <dl className="bg-card divide-y rounded-xl border shadow-card">
            {setup.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <dt className="text-muted-foreground text-sm">{row.label}</dt>
                <dd className={cn("text-sm font-semibold", typeof row.value === "number" && "num")}>
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <section aria-labelledby="activity-heading">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="activity-heading" className="type-h2">
            Recent activity
          </h2>
          <Link href="/scheduling/activity" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Full log
          </Link>
        </div>
        {recentActivity.length === 0 ? (
          <p className="bg-card text-muted-foreground rounded-xl border border-dashed px-5 py-4 text-sm">
            No activity yet. Schedule changes and agent decisions will appear here.
          </p>
        ) : (
          <ul className="bg-card divide-y rounded-xl border shadow-card">
            {recentActivity.map((entry) => (
              <li key={entry.id} className="flex items-baseline gap-3 px-4 py-2.5 text-sm">
                <span aria-hidden className="bg-primary mt-1.5 size-1.5 shrink-0 self-start rounded-full" />
                <span className="min-w-0 flex-1">
                  {entry.title}
                  <span className="text-muted-foreground"> · {entry.actorLabel}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {summary.persona.notes ? (
        <section aria-labelledby="guidance-heading" className="max-w-3xl">
          <h2 id="guidance-heading" className="type-h2 mb-2">
            Assistant guidance
          </h2>
          <p className="text-muted-foreground type-body">{summary.persona.notes}</p>
        </section>
      ) : null}
    </div>
  );
}
