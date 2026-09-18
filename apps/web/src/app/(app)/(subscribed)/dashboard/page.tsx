import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Bell,
  BookOpen,
  CalendarDays,
  MessageSquareText,
  Users,
} from "lucide-react";

import { getAuthUser } from "@/lib/auth/current-user";
import { getDisplayUser } from "@/lib/auth/user";
import { getOrgContext } from "@/lib/org/queries";
import { countDocuments } from "@/lib/documents/queries";
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
  const [user, { activeOrg }] = await Promise.all([getAuthUser(), getOrgContext()]);
  if (!activeOrg) redirect("/onboarding");

  const [documentCount, unreadCount, scheduling, latestSchedule, conversationPage] =
    await Promise.all([
      countDocuments(activeOrg.id),
      getUnreadCount(),
      getSchedulingSummary(activeOrg.id),
      getLatestSchedule(activeOrg.id),
      listConversationsPage(activeOrg.id, { limit: 4 }),
    ]);

  const firstName = user ? getDisplayUser(user).name.split(/\s+/)[0] : null;
  const scheduleState = !scheduling.onboardedAt
    ? "Setup"
    : latestSchedule?.status === "published"
      ? "Live"
      : latestSchedule?.status === "draft"
        ? "Draft"
        : "None";

  return (
    <>
      <PageHeader
        title={firstName ? `Welcome back, ${firstName}` : "Welcome back"}
        description={activeOrg.name}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link href="/knowledge" className="rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40">
          <StatCard
            label="Knowledge"
            value={documentCount}
            hint={documentCount === 1 ? "document available" : "documents available"}
            icon={<BookOpen />}
            className="h-full transition-shadow hover:shadow-card-hover"
          />
        </Link>
        <Link href="/scheduling/employees" className="rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40">
          <StatCard
            label="Active team"
            value={scheduling.employeeCount}
            hint={scheduling.employeeCount === 1 ? "employee in scheduling" : "employees in scheduling"}
            icon={<Users />}
            className="h-full transition-shadow hover:shadow-card-hover"
          />
        </Link>
        <Link href="/notifications" className="rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40">
          <StatCard
            label="Unread"
            value={unreadCount}
            hint={unreadCount === 1 ? "notification needs review" : "notifications need review"}
            icon={<Bell />}
            className="h-full transition-shadow hover:shadow-card-hover"
          />
        </Link>
        <Link href="/scheduling/calendar" className="rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40">
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
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        <Card>
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
                    className="group flex items-center gap-3 py-3.5 outline-none first:pt-0 last:pb-0 focus-visible:ring-[3px] focus-visible:ring-ring/40"
                  >
                    <span className="bg-surface-2 text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
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
                <Link
                  href="/assistant"
                  className={cn(buttonVariants({ size: "sm" }), "mt-4")}
                >
                  Start a conversation
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
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
                <Link
                  href="/scheduling/setup"
                  className={cn(buttonVariants(), "w-full")}
                >
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
                <Link
                  href="/scheduling/calendar"
                  className={cn(buttonVariants(), "w-full")}
                >
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
                <Link
                  href="/scheduling/calendar"
                  className={cn(buttonVariants(), "w-full")}
                >
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
