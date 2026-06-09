import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, Clock, ScrollText, Users } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { buttonVariants } from "@/components/ui/button";
import { getOrgContext } from "@/lib/org/queries";
import { getSchedulingSummary } from "@/lib/scheduling/queries";

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
            <Link href="/scheduling/calendar" className={buttonVariants()}>
              Schedule
            </Link>
            <Link href="/scheduling/employees" className={buttonVariants({ variant: "outline" })}>
              Team
            </Link>
            <Link
              href="/scheduling/availability"
              className={buttonVariants({ variant: "outline" })}
            >
              Availability
            </Link>
            <Link
              href="/scheduling/conversations"
              className={buttonVariants({ variant: "outline" })}
            >
              Conversations
            </Link>
            <Link href="/scheduling/analytics" className={buttonVariants({ variant: "outline" })}>
              Analytics
            </Link>
            <Link href="/scheduling/activity" className={buttonVariants({ variant: "outline" })}>
              Activity log
            </Link>
            <Link href="/scheduling/setup" className={buttonVariants({ variant: "outline" })}>
              Edit setup
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

      {summary.persona.notes ? (
        <section className="bg-card max-w-prose rounded-lg border p-5 shadow-xs">
          <h2 className="type-meta text-muted-foreground">Assistant guidance</h2>
          <p className="text-foreground/90 type-body mt-2">{summary.persona.notes}</p>
        </section>
      ) : null}
    </div>
  );
}
