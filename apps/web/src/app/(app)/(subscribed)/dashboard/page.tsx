import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  BookOpen,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  MessageSquareText,
  Sparkles,
  UserPlus,
  type LucideIcon,
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
import { countPendingApprovals } from "@/lib/scheduling/pending-approvals";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn, formatDateRange } from "@/lib/utils";

type Attention = {
  key: string;
  icon: LucideIcon;
  title: string;
  detail: string;
  href: string;
  action: string;
  tone: "warning" | "default";
};

function formatUpdatedAt(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default async function DashboardPage() {
  const [user, { activeOrg }, schedulingAccess, leadsAccess, automationsAccess] = await Promise.all([
    getAuthUser(),
    getOrgContext(),
    getFeatureAccess("scheduling"),
    getFeatureAccess("leads"),
    getFeatureAccess("automations"),
  ]);
  if (!activeOrg) redirect("/onboarding");
  const canManage = activeOrg.role === "owner" || activeOrg.role === "admin";

  const [
    documentCount,
    unreadCount,
    scheduling,
    latestSchedule,
    conversationPage,
    newLeadCount,
    recentAutomationRuns,
    pendingApprovals,
  ] = await Promise.all([
    countDocuments(activeOrg.id),
    getUnreadCount(),
    getSchedulingSummary(activeOrg.id),
    getLatestSchedule(activeOrg.id),
    listConversationsPage(activeOrg.id, { limit: 5 }),
    leadsAccess.entitled ? countNewLeads(activeOrg.id) : Promise.resolve(null),
    automationsAccess.entitled ? listAutomationRuns(activeOrg.id, 10) : Promise.resolve([]),
    schedulingAccess.entitled && canManage ? countPendingApprovals(activeOrg.id) : Promise.resolve(0),
  ]);

  const firstName = user ? getDisplayUser(user).name.split(/\s+/)[0] : null;
  const failedRuns = recentAutomationRuns.filter((run) => run.status === "failed").length;
  const today = new Intl.DateTimeFormat("en-CA", { weekday: "long", month: "long", day: "numeric" }).format(
    new Date(),
  );

  // Everything below comes from real org state; nothing is shown when it is zero.
  const attention: Attention[] = [];
  if (schedulingAccess.entitled && !scheduling.onboardedAt) {
    attention.push({
      key: "setup",
      icon: CalendarDays,
      title: "Finish scheduling setup",
      detail: "Add business hours, roles and your team before generating a schedule.",
      href: "/scheduling/setup",
      action: "Continue setup",
      tone: "default",
    });
  }
  if (latestSchedule?.status === "draft") {
    attention.push({
      key: "draft",
      icon: CalendarClock,
      title: "A schedule draft is waiting for review",
      detail: `${formatDateRange(latestSchedule.periodStart, latestSchedule.periodEnd)}. Nothing is sent to staff until you publish.`,
      href: "/scheduling/calendar",
      action: "Review draft",
      tone: "default",
    });
  }
  if (pendingApprovals > 0) {
    attention.push({
      key: "approvals",
      icon: CheckSquare,
      title: `${plural(pendingApprovals, "scheduling request needs", "scheduling requests need")} a decision`,
      detail: "Time off, swaps or replacements that were escalated to a manager.",
      href: "/scheduling/approvals",
      action: "Review",
      tone: "warning",
    });
  }
  if (failedRuns > 0) {
    attention.push({
      key: "runs",
      icon: AlertTriangle,
      title: `${plural(failedRuns, "automation run", "automation runs")} failed recently`,
      detail: "Open the run history to see the error and retry or pause the workflow.",
      href: "/automations",
      action: "View runs",
      tone: "warning",
    });
  }
  if (newLeadCount) {
    attention.push({
      key: "leads",
      icon: UserPlus,
      title: `${plural(newLeadCount, "new lead", "new leads")} to follow up`,
      detail: "Leads still marked New in the pipeline.",
      href: "/leads",
      action: "Open pipeline",
      tone: "default",
    });
  }
  if (unreadCount > 0) {
    attention.push({
      key: "notifications",
      icon: Bell,
      title: `${plural(unreadCount, "unread notification", "unread notifications")}`,
      detail: "Updates from scheduling, leads and automations.",
      href: "/notifications",
      action: "Open inbox",
      tone: "default",
    });
  }
  if (documentCount === 0) {
    attention.push({
      key: "documents",
      icon: BookOpen,
      title: "Add your first document",
      detail: "The assistant answers only from documents you upload.",
      href: "/knowledge",
      action: "Upload",
      tone: "default",
    });
  }

  const scheduleState = !schedulingAccess.entitled
    ? null
    : !scheduling.onboardedAt
      ? "Not set up"
      : latestSchedule?.status === "published"
        ? "Published"
        : latestSchedule?.status === "draft"
          ? "Draft"
          : "No schedule yet";

  const glance: { label: string; value: React.ReactNode; href: string }[] = [
    { label: "Documents", value: documentCount, href: "/knowledge" },
    ...(schedulingAccess.entitled
      ? [
          { label: "Active team", value: scheduling.employeeCount, href: "/scheduling/employees" },
          { label: "Schedule", value: scheduleState, href: "/scheduling/calendar" },
        ]
      : []),
    ...(leadsAccess.entitled ? [{ label: "New leads", value: newLeadCount ?? 0, href: "/leads" }] : []),
    ...(automationsAccess.entitled
      ? [{ label: "Failed runs (last 10)", value: failedRuns, href: "/automations" }]
      : []),
  ];

  return (
    <>
      <PageHeader
        title={firstName ? `Welcome back, ${firstName}` : "Welcome back"}
        description={`${today} · ${activeOrg.name}`}
        actions={
          <Link href="/assistant" className={buttonVariants({ variant: "outline" })}>
            <Sparkles aria-hidden />
            Ask the assistant
          </Link>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby="attention-heading" className="min-w-0">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 id="attention-heading" className="type-h2">
              Needs attention
            </h2>
            {attention.length ? (
              <span className="text-muted-foreground text-sm">{plural(attention.length, "item", "items")}</span>
            ) : null}
          </div>
          {attention.length ? (
            <ul className="bg-card divide-y rounded-xl border shadow-card">
              {attention.map((item) => (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    className="group focus-visible:ring-ring/40 flex items-center gap-4 px-4 py-3.5 outline-none transition-colors hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-inset sm:px-5"
                  >
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-lg",
                        item.tone === "warning"
                          ? "bg-warning/10 text-warning"
                          : "bg-primary-soft text-primary-soft-foreground",
                      )}
                      aria-hidden
                    >
                      <item.icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{item.title}</span>
                      <span className="text-muted-foreground type-small block">{item.detail}</span>
                    </span>
                    <span className="text-primary-soft-foreground hidden shrink-0 items-center gap-1 text-sm font-semibold sm:inline-flex">
                      {item.action}
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </span>
                    <ArrowRight className="text-muted-foreground size-4 shrink-0 sm:hidden" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="bg-card flex items-center gap-3 rounded-xl border px-5 py-4 shadow-card">
              <CheckCircle2 className="text-success size-5 shrink-0" aria-hidden />
              <div>
                <p className="text-sm font-semibold">You&apos;re all caught up</p>
                <p className="text-muted-foreground type-small">
                  No drafts, approvals, failed runs or unread updates right now.
                </p>
              </div>
            </div>
          )}
        </section>

        <section aria-labelledby="glance-heading">
          <h2 id="glance-heading" className="type-h2 mb-3">
            At a glance
          </h2>
          <ul className="bg-card divide-y rounded-xl border shadow-card">
            {glance.map((row) => (
              <li key={row.label}>
                <Link
                  href={row.href}
                  className="focus-visible:ring-ring/40 flex items-center justify-between gap-3 px-4 py-3 outline-none transition-colors hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-inset"
                >
                  <span className="text-muted-foreground text-sm">{row.label}</span>
                  <span className={cn("text-sm font-semibold", typeof row.value === "number" && "num")}>{row.value}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="conversations-heading" className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="conversations-heading" className="type-h2">
              Recent conversations
            </h2>
            <Link href="/assistant" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              View all
            </Link>
          </div>
          {conversationPage.conversations.length ? (
            <ul className="bg-card divide-y rounded-xl border shadow-card">
              {conversationPage.conversations.map((conversation) => (
                <li key={conversation.id}>
                  <Link
                    href={`/assistant?c=${conversation.id}`}
                    className="focus-visible:ring-ring/40 flex items-center gap-3 px-4 py-3 outline-none transition-colors hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-inset"
                  >
                    <MessageSquareText className="text-muted-foreground size-4 shrink-0" aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{conversation.title}</span>
                    <span className="text-muted-foreground type-small shrink-0">
                      {formatUpdatedAt(conversation.updatedAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="bg-card rounded-xl border border-dashed px-5 py-6">
              <p className="text-sm font-semibold">No conversations yet</p>
              <p className="text-muted-foreground type-small mt-1">
                Ask a question about your policies or procedures and the answer will cite its sources.
              </p>
              <Link href="/assistant" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-4")}>
                Start a conversation
              </Link>
            </div>
          )}
        </section>

        {schedulingAccess.entitled ? (
          <section aria-labelledby="schedule-heading" className="min-w-0">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 id="schedule-heading" className="type-h2">
                Schedule
              </h2>
              <Link href="/scheduling" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                Scheduling
              </Link>
            </div>
            <div className="bg-card rounded-xl border p-5 shadow-card">
              {!scheduling.onboardedAt ? (
                <>
                  <Badge variant="warning">Setup required</Badge>
                  <p className="text-muted-foreground type-small mt-2">
                    Add business hours, roles, team members and rules before generating a schedule.
                  </p>
                  <Link href="/scheduling/setup" className={cn(buttonVariants(), "mt-4")}>
                    Complete setup
                  </Link>
                </>
              ) : latestSchedule ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{formatDateRange(latestSchedule.periodStart, latestSchedule.periodEnd)}</p>
                    <Badge variant={latestSchedule.status === "published" ? "success" : "default"}>
                      {latestSchedule.status === "published" ? "Published" : "Draft"}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground type-small mt-2 line-clamp-3">
                    {latestSchedule.optimizationSummary ??
                      "Open the calendar to review shifts, coverage and conflicts."}
                  </p>
                  <Link
                    href="/scheduling/calendar"
                    className={cn(buttonVariants({ variant: latestSchedule.status === "draft" ? "default" : "outline" }), "mt-4")}
                  >
                    {latestSchedule.status === "draft" ? "Review and publish" : "Open schedule"}
                  </Link>
                </>
              ) : (
                <>
                  <p className="font-semibold">No schedule yet</p>
                  <p className="text-muted-foreground type-small mt-1">
                    Setup is complete. Generate a draft when you&apos;re ready; you review it before anyone sees it.
                  </p>
                  <Link href="/scheduling/calendar" className={cn(buttonVariants(), "mt-4")}>
                    Create schedule
                  </Link>
                </>
              )}
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}
