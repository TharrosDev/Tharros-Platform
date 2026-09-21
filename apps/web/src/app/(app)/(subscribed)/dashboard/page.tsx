import Link from "next/link";
import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";

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
import { Bay, InitialsBox, LogLine, RecordLog, Strip, StripBody } from "@/components/board/board";
import { buttonVariants } from "@/components/ui/button";
import { cn, formatDateRange } from "@/lib/utils";

export const metadata = { title: "Board" };

/*
  A strip in the lead bay. No icon: the tab and the stock carry state, and an
  icon tile beside a title is the arrangement this board refuses.
*/
type Attention = {
  key: string;
  title: string;
  detail: string;
  href: string;
  action: string;
  urgent: boolean;
};

const timeOfDay = new Intl.DateTimeFormat("en-CA", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const dayStamp = new Intl.DateTimeFormat("en-CA", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default async function DashboardPage() {
  const [user, { activeOrg }, schedulingAccess, leadsAccess, automationsAccess] = await Promise.all(
    [
      getAuthUser(),
      getOrgContext(),
      getFeatureAccess("scheduling"),
      getFeatureAccess("leads"),
      getFeatureAccess("automations"),
    ],
  );
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
    listConversationsPage(activeOrg.id, { limit: 6 }),
    leadsAccess.entitled ? countNewLeads(activeOrg.id) : Promise.resolve(null),
    automationsAccess.entitled ? listAutomationRuns(activeOrg.id, 10) : Promise.resolve([]),
    schedulingAccess.entitled && canManage
      ? countPendingApprovals(activeOrg.id)
      : Promise.resolve(0),
  ]);

  const firstName = user ? getDisplayUser(user).name.split(/\s+/)[0] : null;
  const failedRuns = recentAutomationRuns.filter((run) => run.status === "failed").length;
  const now = new Date();

  // Everything below comes from real org state; nothing is shown when it is zero.
  const attention: Attention[] = [];
  if (schedulingAccess.entitled && !scheduling.onboardedAt) {
    attention.push({
      key: "setup",
      title: "Finish scheduling setup",
      detail: "Business hours, roles and your team, before any schedule can be generated.",
      href: "/scheduling/setup",
      action: "Continue setup",
      urgent: false,
    });
  }
  if (latestSchedule?.status === "draft") {
    attention.push({
      key: "draft",
      title: "A schedule draft is waiting for review",
      detail: `${formatDateRange(latestSchedule.periodStart, latestSchedule.periodEnd)}. Nothing reaches staff until you publish it.`,
      href: "/scheduling/calendar",
      action: "Review draft",
      urgent: false,
    });
  }
  if (pendingApprovals > 0) {
    attention.push({
      key: "approvals",
      title: `${plural(pendingApprovals, "scheduling request needs", "scheduling requests need")} a decision`,
      detail: "Time off, swaps or replacements escalated to a manager.",
      href: "/scheduling/approvals",
      action: "Review",
      urgent: true,
    });
  }
  if (failedRuns > 0) {
    attention.push({
      key: "runs",
      title: `${plural(failedRuns, "automation run", "automation runs")} failed recently`,
      detail: "Open the run history for the error, then retry or pause the workflow.",
      href: "/automations",
      action: "View runs",
      urgent: true,
    });
  }
  if (newLeadCount) {
    attention.push({
      key: "leads",
      title: `${plural(newLeadCount, "new lead", "new leads")} to follow up`,
      detail: "Leads still marked New in the pipeline.",
      href: "/leads",
      action: "Open pipeline",
      urgent: false,
    });
  }
  if (unreadCount > 0) {
    attention.push({
      key: "notifications",
      title: plural(unreadCount, "unread notification", "unread notifications"),
      detail: "Updates from scheduling, leads and automations.",
      href: "/notifications",
      action: "Open inbox",
      urgent: false,
    });
  }
  if (documentCount === 0) {
    attention.push({
      key: "documents",
      title: "Add your first document",
      detail: "The assistant answers only from documents you have uploaded.",
      href: "/knowledge",
      action: "Upload",
      urgent: false,
    });
  }

  const scheduleState = !scheduling.onboardedAt
    ? "Not set up"
    : (latestSchedule?.status ?? "none") === "published"
      ? "Published"
      : latestSchedule?.status === "draft"
        ? "Draft"
        : "None yet";

  const onTheBoard: { label: string; value: React.ReactNode; href: string; tone?: "pending" }[] = [
    { label: "Documents in knowledge", value: documentCount, href: "/knowledge" },
    ...(schedulingAccess.entitled
      ? [
          {
            label: "Employees on the roster",
            value: scheduling.employeeCount,
            href: "/scheduling/employees",
          },
          {
            label: "Current schedule",
            value: scheduleState,
            href: "/scheduling/calendar",
            ...(latestSchedule?.status === "draft" ? { tone: "pending" as const } : {}),
          },
        ]
      : []),
    ...(leadsAccess.entitled
      ? [{ label: "Leads marked new", value: newLeadCount ?? 0, href: "/leads" }]
      : []),
    ...(automationsAccess.entitled
      ? [{ label: "Failed runs, last ten", value: failedRuns, href: "/automations" }]
      : []),
  ];

  // The record: what the system printed for itself, newest first.
  const record = [
    ...conversationPage.conversations.map((conversation) => ({
      at: new Date(conversation.updatedAt),
      text: conversation.title,
      source: "Assistant",
      href: `/assistant?c=${conversation.id}`,
    })),
    ...recentAutomationRuns.map((run) => ({
      at: new Date(run.createdAt),
      text:
        run.status === "failed"
          ? `Workflow run failed${run.error ? `: ${run.error}` : ""}`
          : `Workflow run ${run.status}`,
      source: "Automations",
      href: "/automations",
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 8);

  return (
    <>
      {/* Board header: who, where, when. Struck to the top of the board. */}
      <header className="border-border flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b pb-5">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="type-h1">{activeOrg.name}</h1>
          <p className="type-meta text-muted-foreground">
            {dayStamp.format(now)} · {timeOfDay.format(now)}
            {firstName ? ` · Welcome, ${firstName}` : null}
          </p>
        </div>
        <Link href="/assistant" className={buttonVariants({ variant: "outline", size: "sm" })}>
          <Sparkles aria-hidden />
          Ask the assistant
        </Link>
      </header>

      <div className="grid gap-x-8 gap-y-8 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <Bay
          headingId="initials-heading"
          label="Ready for your review"
          count={attention.length}
          lead
        >
          {attention.length ? (
            attention.map((item, index) => (
              <Strip
                key={item.key}
                tone={item.urgent ? "signal" : "pending"}
                seatIndex={index}
                className="group"
              >
                <Link
                  href={item.href}
                  className="hover:bg-foreground/[0.04] flex flex-1 transition-colors"
                >
                  <StripBody
                    what={item.title}
                    detail={item.detail}
                    mark={<InitialsBox label={item.action} />}
                  />
                </Link>
              </Strip>
            ))
          ) : (
            <Strip tone="cleared">
              <StripBody
                what="Nothing is waiting on you"
                detail="No drafts, approvals, failed runs or unread updates right now."
              />
            </Strip>
          )}
        </Bay>

        <Bay headingId="board-heading" label="Your workspace at a glance" count={onTheBoard.length}>
          {onTheBoard.map((row) => (
            <Strip key={row.label} tone={row.tone ?? "plain"}>
              <Link
                href={row.href}
                className="hover:bg-foreground/[0.04] flex flex-1 transition-colors"
              >
                <StripBody
                  what={row.label}
                  mark={
                    <span
                      className={cn(
                        "type-strip font-semibold",
                        typeof row.value === "number" && "num",
                      )}
                    >
                      {row.value}
                    </span>
                  }
                />
              </Link>
            </Strip>
          ))}
        </Bay>
      </div>

      <RecordLog
        headingId="record-heading"
        label="Recent activity"
        action={
          <Link href="/notifications" className={buttonVariants({ variant: "link", size: "sm" })}>
            Open inbox
          </Link>
        }
      >
        {record.length ? (
          record.map((line, index) => (
            <LogLine
              key={`${line.source}-${index}`}
              time={timeOfDay.format(line.at)}
              source={line.source}
              href={line.href}
            >
              {line.text}
            </LogLine>
          ))
        ) : (
          <LogLine time={timeOfDay.format(now)} source="System">
            Nothing has been recorded yet. Your team’s recent work will appear here.
          </LogLine>
        )}
      </RecordLog>
    </>
  );
}
