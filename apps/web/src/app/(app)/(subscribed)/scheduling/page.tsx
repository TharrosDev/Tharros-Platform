import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarClock,
  CalendarDays,
  ChartColumn,
  ChevronRight,
  Clock,
  History,
  MessagesSquare,
  ScrollText,
  Users,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { buttonVariants } from "@/components/ui/button";
import { getOrgContext } from "@/lib/org/queries";
import { getSchedulingSummary } from "@/lib/scheduling/queries";

const MANAGE_LINKS = [
  {
    href: "/scheduling/employees",
    icon: Users,
    label: "Team",
    description: "Roster, roles, and portal access",
  },
  {
    href: "/scheduling/availability",
    icon: CalendarClock,
    label: "Availability",
    description: "When each person can work",
  },
  {
    href: "/scheduling/conversations",
    icon: MessagesSquare,
    label: "Conversations",
    description: "Agent threads you can take over",
  },
  {
    href: "/scheduling/analytics",
    icon: ChartColumn,
    label: "Analytics",
    description: "Coverage, reliability, and disruption",
  },
  {
    href: "/scheduling/activity",
    icon: History,
    label: "Activity log",
    description: "Every agent decision and schedule change",
  },
] as const;

/**
 * Day 43 — scheduling home. Routes the owner to the setup wizard until it's been
 * completed; afterward shows a short summary of what was configured. The real
 * scheduling surfaces (availability, schedule generation) land in later days.
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

export default async function SchedulingPage() {
  const { activeOrg } = await getOrgContext();
  if (!activeOrg) redirect("/dashboard");

  const summary = await getSchedulingSummary(activeOrg.id);
  if (!summary.onboardedAt) redirect("/scheduling/setup");

  return (
    <div className="space-y-8">
      <PageHeader
        title="Scheduling"
        description="Your scheduling workspace is set up. Availability and schedule generation arrive next."
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

      <section className="space-y-3">
        <h2 className="type-meta text-muted-foreground">Manage</h2>
        <nav className="bg-card divide-border divide-y overflow-hidden rounded-lg border shadow-xs">
          {MANAGE_LINKS.map(({ href, icon: Icon, label, description }) => (
            <Link
              key={href}
              href={href}
              className="hover:bg-accent focus-visible:bg-accent focus-visible:ring-ring/50 group flex items-center gap-4 px-5 py-4 transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-inset"
            >
              <span className="bg-primary-soft text-primary-soft-foreground flex size-9 shrink-0 items-center justify-center rounded-md [&>svg]:size-4.5">
                <Icon />
              </span>
              <span className="min-w-0">
                <span className="block font-medium">{label}</span>
                <span className="text-muted-foreground type-small block">{description}</span>
              </span>
              <ChevronRight className="text-muted-foreground/60 group-hover:text-muted-foreground ml-auto size-4 shrink-0 transition-colors" />
            </Link>
          ))}
        </nav>
      </section>

      {summary.persona.notes ? (
        <section className="bg-card max-w-prose rounded-lg border p-5 shadow-xs">
          <h2 className="type-meta text-muted-foreground">Assistant guidance</h2>
          <p className="text-foreground/90 type-body mt-2">{summary.persona.notes}</p>
        </section>
      ) : null}
    </div>
  );
}
