import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  ArrowRight,
  Bell,
  BookOpen,
  CalendarDays,
  MessageSquareText,
  Sparkles,
  Users,
  Workflow,
} from "lucide-react";

import { getAuthUser } from "@/lib/auth/current-user";
import { getDisplayUser } from "@/lib/auth/user";
import { getFeatureAccess } from "@/lib/billing/entitlements";
import { getOrgContext } from "@/lib/org/queries";
import { countDocuments } from "@/lib/documents/queries";
import { countNewLeads } from "@/lib/leads/queries";
import { listAutomationRuns } from "@/lib/automations/queries";
import { listConversationsPage } from "@/lib/assistant/conversations";
import { getUnreadCount } from "@/lib/notifications/queries";
import { getLatestSchedule, getSchedulingSummary } from "@/lib/scheduling/queries";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function formatUpdatedAt(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function DashboardPage() {
  const [user, { activeOrg }, leadsAccess, automationsAccess] = await Promise.all([
    getAuthUser(),
    getOrgContext(),
    getFeatureAccess("leads"),
    getFeatureAccess("automations"),
  ]);
  if (!activeOrg) redirect("/onboarding");

  const [
    documentCount,
    unreadCount,
    scheduling,
    latestSchedule,
    conversationPage,
    newLeadCount,
    recentAutomationRuns,
  ] = await Promise.all([
    countDocuments(activeOrg.id),
    getUnreadCount(),
    getSchedulingSummary(activeOrg.id),
    getLatestSchedule(activeOrg.id),
    listConversationsPage(activeOrg.id, { limit: 4 }),
    leadsAccess.entitled ? countNewLeads(activeOrg.id) : Promise.resolve(null),
    automationsAccess.entitled
      ? listAutomationRuns(activeOrg.id, 10)
      : Promise.resolve([]),
  ]);

  const firstName = user ? getDisplayUser(user).name.split(/\s+/)[0] : null;
  const scheduleState = !scheduling.onboardedAt
    ? "Setup"
    : latestSchedule?.status === "published"
      ? "Live"
      : latestSchedule?.status === "draft"
        ? "Draft"
        : "None";
  const failedAutomationRuns = recentAutomationRuns.filter((run) => run.status === "failed").length;

  return (
    <>
      <PageHeader
        title={firstName ? `Welcome back, ${firstName}` : "Welcome back"}
        description={activeOrg.name}
      />

      <section className="visual-panel-strong relative overflow-hidden rounded-3xl p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-20 size-72 rounded-full bg-primary/12 blur-3xl" aria-hidden />
        <div className="relative grid gap-8 xl:grid-cols-[1.15fr_0.85fr] xl:items-end">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary-soft/70 px-3 py-1.5 text-primary-soft-foreground shadow-xs">
              <Sparkles className="size-3.5" aria-hidden />
              <span className="type-meta">Live operations</span>
            </div>
            <h2 className="max-w-2xl text-2xl font-bold tracking-[-0.035em] text-balance sm:text-3xl">
              Your business command center is up to date.
            </h2>
            <p className="text-muted-foreground mt-3 max-w-2xl text-sm leading-relaxed sm:text-base">
              Knowledge, scheduling, lead activity and automation health are connected across
              {activeOrg.name}. Review the signals below, then jump directly into the work.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
            <div className="rounded-2xl border border-border/70 bg-background/55 p-3.5 backdrop-blur-md">
              <p className="type-meta text-muted-foreground">Knowledge</p>
              <p className="num mt-2 text-xl font-bold tracking-tight">{documentCount}</p>
              <p className="text-muted-foreground mt-1 text-xs">indexed documents</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/55 p-3.5 backdrop-blur-md">
              <p className="type-meta text-muted-foreground">Schedule</p>
              <p className="mt-2 text-xl font-bold tracking-tight">{scheduleState}</p>
              <p className="text-muted-foreground mt-1 text-xs">current state</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/55 p-3.5 backdrop-blur-md">
              <p className="type-meta text-muted-foreground">Attention</p>
              <p className="num mt-2 text-xl font-bold tracking-tight">
                {unreadCount + failedAutomationRuns + (newLeadCount ?? 0)}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">open signals</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <Link href="/knowledge" className="rounded-2xl outline-none focus-visible:ring-[4px] focus-visible:ring-ring/30">
          <StatCard
            label="Knowledge"
            value={documentCount}
            hint={documentCount === 1 ? "document available" : "documents available"}
            icon={<BookOpen />}
            className="h-full transition-shadow hover:shadow-card-hover"
          />
        </Link>
        <Link href="/scheduling/employees" className="rounded-2xl outline-none focus-visible:ring-[4px] focus-visible:ring-ring/30">
          <StatCard
            label="Active team"
            value={scheduling.employeeCount}
            hint={scheduling.employeeCount === 1 ? "employee in scheduling" : "employees in scheduling"}
            icon={<Users />}
            className="h-full transition-shadow hover:shadow-card-hover"
          />
        </Link>
        <Link href="/notifications" className="rounded-2xl outline-none focus-visible:ring-[4px] focus-visible:ring-ring/30">
          <StatCard
            label="Unread"
            value={unreadCount}
            hint={unreadCount === 1 ? "notification needs review" : "notifications need review"}
            icon={<Bell />}
            className="h-full transition-shadow hover:shadow-card-hover"
          />
        </Link>
        <Link href="/scheduling/calendar" className="rounded-2xl outline-none focus-visible:ring-[4px] focus-visible:ring-ring/30">
          <StatCard
            label="Schedule"
            value={scheduleState}
            hint={
              latestSchedule
                ? `${latestSchedule.periodStart} to ${latestSchedule.periodEnd}`
                : scheduling.onboardedAt
                  ? "No schedule created yet"
                  : "Scheduling setup is not complete"
            }
            icon={<CalendarDays />}
            className="h-full transition-shadow hover:shadow-card-hover"
          />
        </Link>
        {leadsAccess.entitled ? (
          <Link href="/leads" className="rounded-2xl outline-none focus-visible:ring-[4px] focus-visible:ring-ring/30">
            <StatCard
              label="New leads"
              value={newLeadCount ?? 0}
              hint={(newLeadCount ?? 0) === 1 ? "new enquiry" : "new enquiries"}
              icon={<Users />}
              className="h-full transition-shadow hover:shadow-card-hover"
            />
          </Link>
        ) : null}
        {automationsAccess.entitled ? (
          <Link href="/automations" className="rounded-2xl outline-none focus-visible:ring-[4px] focus-visible:ring-ring/30">
            <StatCard
              label="Automation issues"
              value={failedAutomationRuns}
              hint={failedAutomationRuns ? "failed recent runs" : "recent runs healthy"}
              icon={<Workflow />}
              className="h-full transition-shadow hover:shadow-card-hover"
            />
          </Link>
        ) : null}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
        <Card className="visual-panel-strong">
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Recent assistant conversations</CardTitle>
              <CardDescription>
                The latest grounded conversations visible in this organization.
              </CardDescription>
            </div>
            <Link href="/assistant" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Open assistant
            </Link>
          </CardHeader>
          <CardContent>
            {conversationPage.conversations.length ? (
              <div className="divide-y divide-border">
                {conversationPage.conversations.map((conversation) => (
                  <Link
                    key={conversation.id}
                    href={`/assistant?c=${conversation.id}`}
                    className="group -mx-2 flex items-center gap-3 rounded-xl px-2 py-3.5 outline-none transition-colors hover:bg-primary-soft/35 first:pt-0 last:pb-0 focus-visible:ring-[4px] focus-visible:ring-ring/30"
                  >
                    <span className="bg-primary-soft text-primary-soft-foreground flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/10 shadow-xs transition-transform group-hover:scale-105">
                      <MessageSquareText className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{conversation.title}</span>
                      <span className="text-muted-foreground type-small">
                        Updated {formatUpdatedAt(conversation.updatedAt)}
                      </span>
                    </span>
                    <ArrowRight className="text-muted-foreground size-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="bg-surface-2 rounded-xl border border-dashed border-border p-6">
                <p className="text-sm font-medium">No assistant conversations yet</p>
                <p className="text-muted-foreground type-small mt-1">
                  Upload business documents, then ask your first grounded question.
                </p>
                <Link href="/assistant" className={cn(buttonVariants({ size: "sm" }), "mt-4")}>
                  Start a conversation
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden bg-gradient-to-b from-card to-primary-soft/15">
          <CardHeader>
            <CardTitle>Scheduling</CardTitle>
            <CardDescription>Current organization scheduling state.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {!scheduling.onboardedAt ? (
              <>
                <div>
                  <Badge variant="warning">Setup required</Badge>
                  <p className="text-muted-foreground type-small mt-2">
                    Add business hours, roles, team members and scheduling rules before generating
                    a schedule.
                  </p>
                </div>
                <Link href="/scheduling/setup" className={cn(buttonVariants(), "w-full")}>
                  Complete scheduling setup
                </Link>
              </>
            ) : latestSchedule ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <Badge variant={latestSchedule.status === "published" ? "success" : "secondary"}>
                    {latestSchedule.status === "published" ? "Published" : "Draft"}
                  </Badge>
                  <span className="text-muted-foreground type-meta">
                    {latestSchedule.periodStart} – {latestSchedule.periodEnd}
                  </span>
                </div>
                <div>
                  <p className="font-medium">{latestSchedule.name}</p>
                  {latestSchedule.optimizationSummary ? (
                    <p className="text-muted-foreground type-small mt-1 line-clamp-3">
                      {latestSchedule.optimizationSummary}
                    </p>
                  ) : (
                    <p className="text-muted-foreground type-small mt-1">
                      Open the calendar to review shifts and schedule actions.
                    </p>
                  )}
                </div>
                <Link href="/scheduling/calendar" className={cn(buttonVariants(), "w-full")}>
                  Open schedule
                </Link>
              </>
            ) : (
              <>
                <div>
                  <Badge variant="secondary">Ready</Badge>
                  <p className="text-muted-foreground type-small mt-2">
                    Setup is complete. Generate the first schedule when you are ready.
                  </p>
                </div>
                <Link href="/scheduling/calendar" className={cn(buttonVariants(), "w-full")}>
                  Create schedule
                </Link>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
