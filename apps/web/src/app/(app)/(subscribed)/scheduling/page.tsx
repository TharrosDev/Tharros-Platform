import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  CheckSquare,
  Clock,
  ScrollText,
  Users,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { getOrgContext } from "@/lib/org/queries";
import { getRoster } from "@/lib/employees/queries";
import {
  getEscalatedReplacements,
  getEscalatedSwaps,
  getLatestSchedule,
  getSchedulingSummary,
} from "@/lib/scheduling/queries";
import { getPendingTimeOff } from "@/lib/scheduling/time-off";
import { getScheduleActivityPage } from "@/lib/audit/queries";
import { presentActivityFeed } from "@/lib/audit/present";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Scheduling overview: setup summary stats, what needs the manager (linking
 * to the Approvals inbox), the latest schedule's state, and a strip of recent
 * activity. Routes to the setup wizard until setup completes.
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

const SCHEDULE_STATUS: Record<string, { label: string; variant: "secondary" | "success" }> = {
  draft: { label: "Draft in progress", variant: "secondary" },
  published: { label: "Published", variant: "success" },
};

export default async function SchedulingPage() {
  const { activeOrg } = await getOrgContext();
  if (!activeOrg) redirect("/dashboard");

  const summary = await getSchedulingSummary(activeOrg.id);
  if (!summary.onboardedAt) redirect("/scheduling/setup");

  const roster = await getRoster();
  const canManage = roster.viewerRole === "owner" || roster.viewerRole === "admin";

  const [schedule, activityPage] = await Promise.all([
    getLatestSchedule(activeOrg.id),
    getScheduleActivityPage(activeOrg.id),
  ]);
  const recentActivity = presentActivityFeed(activityPage.rows.slice(0, 5));

  let pendingApprovals = 0;
  if (canManage) {
    const [swaps, timeOff, replacements] = await Promise.all([
      getEscalatedSwaps(activeOrg.id),
      getPendingTimeOff(createAdminClient(), activeOrg.id),
      getEscalatedReplacements(activeOrg.id),
    ]);
    pendingApprovals =
      swaps.length + timeOff.filter((t) => t.status === "pending").length + replacements.length;
  }

  const status = schedule ? SCHEDULE_STATUS[schedule.status] : null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Scheduling"
        description="The agent collects availability, drafts the schedule, and handles disruptions. You approve."
        actions={
          <>
            <Link href="/scheduling/setup" className={buttonVariants({ variant: "ghost" })}>
              Edit setup
            </Link>
            <Link href="/scheduling/calendar" className={buttonVariants()}>
              Open schedule
            </Link>
          </>
        }
      />

      {canManage ? (
        <Card className="visual-panel-strong overflow-hidden p-0">
          <Link
            href="/scheduling/approvals"
            className="group flex items-center gap-4 p-5 outline-none transition-[background-color,transform] hover:bg-primary-soft/25 focus-visible:ring-ring/30 focus-visible:ring-[4px] focus-visible:ring-inset"
          >
            <span
              className={
                pendingApprovals > 0
                  ? "bg-warning/15 text-warning flex size-11 shrink-0 items-center justify-center rounded-xl border border-warning/15 shadow-xs [&>svg]:size-5"
                  : "bg-success/15 text-success flex size-11 shrink-0 items-center justify-center rounded-xl border border-success/15 shadow-xs [&>svg]:size-5"
              }
            >
              <CheckSquare />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">
                {pendingApprovals > 0
                  ? `${pendingApprovals} decision${pendingApprovals === 1 ? "" : "s"} waiting on you`
                  : "Nothing needs your call"}
              </span>
              <span className="text-muted-foreground type-small block">
                {pendingApprovals > 0
                  ? "Swaps, time off, and unfilled shifts the agent flagged for a human."
                  : "Escalations from the agent will land in your Approvals inbox."}
              </span>
            </span>
            <ArrowRight className="text-muted-foreground/60 group-hover:text-muted-foreground size-4 shrink-0 transition-transform duration-150 ease-out group-hover:translate-x-0.5" />
          </Link>
        </Card>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Users />} label="Team members" value={String(summary.employeeCount)} />
        <StatCard icon={<Clock />} label="Open days / week" value={String(summary.openDays)} />
        <StatCard
          icon={<ScrollText />}
          label="Labor rules"
          value={PRESET_LABEL[summary.preset] ?? summary.preset}
        />
        <StatCard
          icon={<CalendarDays />}
          label="Assistant voice"
          value={TONE_LABEL[summary.persona.tone] ?? summary.persona.tone}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="visual-panel-strong">
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              Latest schedule
              {status ? <Badge variant={status.variant}>{status.label}</Badge> : null}
            </CardTitle>
            <CardDescription>
              {schedule
                ? `Covers ${schedule.periodStart} to ${schedule.periodEnd}.`
                : "No schedule yet. Generate a draft from the calendar to get started."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/scheduling/calendar"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              {schedule ? "Review on the calendar" : "Generate a draft"}
            </Link>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-b from-card to-surface-2/35">
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>The last few schedule changes and agent decisions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentActivity.length === 0 ? (
              <p className="text-muted-foreground type-small">No activity yet.</p>
            ) : (
              <>
                <ul className="space-y-2">
                  {recentActivity.map((entry) => (
                    <li key={entry.id} className="flex items-baseline gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-primary-soft/25">
                      <span className="bg-primary/60 mt-1.5 size-1.5 shrink-0 self-start rounded-full" />
                      <span className="min-w-0 flex-1 truncate">
                        {entry.title}
                        <span className="text-muted-foreground"> · {entry.actorLabel}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/scheduling/activity"
                  className="text-primary inline-block text-xs font-medium hover:underline"
                >
                  View the full activity log
                </Link>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {summary.persona.notes ? (
        <section className="visual-panel-strong max-w-3xl rounded-2xl p-6">
          <h2 className="type-meta text-muted-foreground">Assistant guidance</h2>
          <p className="text-foreground/90 type-body mt-2">{summary.persona.notes}</p>
        </section>
      ) : null}
    </div>
  );
}
