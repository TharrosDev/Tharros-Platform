import Link from "next/link";
import { ArrowRight, ArrowUpRight, CalendarDays, Sparkles, Users, Workflow } from "lucide-react";

import { getAuthUser } from "@/lib/auth/current-user";
import { getDisplayUser } from "@/lib/auth/user";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { NewAutomationButton } from "@/components/shell/new-automation-button";
import { CountUp } from "@/components/motion";

const products = [
  {
    name: "AI Assistant",
    href: "/assistant",
    blurb: "Answers your customers in plain language, day or night.",
    icon: Sparkles,
  },
  {
    name: "Scheduling",
    href: "/scheduling",
    blurb: "Builds the week's schedule and handles sick calls and swaps.",
    icon: CalendarDays,
  },
  {
    name: "Lead Capture",
    href: "/leads",
    blurb: "Catches every enquiry and follows up so none slip away.",
    icon: Users,
  },
  {
    name: "Automations",
    href: "/automations",
    blurb: "Handles the busywork between the tools you already use.",
    icon: Workflow,
  },
];

// The handful of things that actually need the owner. The focal point of the page.
const waiting = [
  {
    who: "Capital Plumbing",
    what: "wants to confirm a callback for Thursday at 2pm",
    when: "2m ago",
    initials: "CP",
    href: "/leads",
  },
  {
    who: "Rideau Dental",
    what: "your assistant drafted an after-hours reply to approve",
    when: "1h ago",
    initials: "RD",
    href: "/assistant",
  },
  {
    who: "Maverick Coffee",
    what: "3 new leads from the contact form need a first touch",
    when: "3h ago",
    initials: "MC",
    href: "/leads",
  },
];

const activity = [
  {
    who: "Rideau Dental",
    what: "got an after-hours reply from your assistant",
    when: "1h ago",
    initials: "RD",
  },
  {
    who: "Maverick Coffee",
    what: "added 3 new leads from the contact form",
    when: "3h ago",
    initials: "MC",
  },
  {
    who: "Hintonburg Bakery",
    what: "finished the welcome follow-up",
    when: "Yesterday",
    initials: "HB",
  },
  {
    who: "Glebe Physio",
    what: "booked 2 appointments overnight",
    when: "Yesterday",
    initials: "GP",
  },
];

export default async function DashboardPage() {
  // First name from the signed-in user (full_name → email local-part fallback).
  // The (app) layout guarantees a user.
  const user = await getAuthUser();
  const firstName = user ? getDisplayUser(user).name.split(/\s+/)[0] : null;

  return (
    <>
      <PageHeader
        title={firstName ? `Welcome back, ${firstName}` : "Welcome back"}
        description="Here's what Tharros handled while you were out. A few things are waiting on your call."
        actions={<NewAutomationButton />}
      />

      {/* Focal point: what needs the owner. */}
      <Card className="overflow-hidden p-0 shadow-raised">
        <div className="grid gap-px sm:grid-cols-[minmax(0,17rem)_1fr]">
          {/* Count rail */}
          <div className="bg-primary text-primary-foreground flex flex-col justify-between gap-8 p-6 sm:p-7">
            <div className="flex items-center justify-between gap-2">
              <span className="type-meta text-primary-foreground/90">Waiting on you</span>
              <Badge variant="secondary">Sample preview</Badge>
            </div>
            <div>
              <div className="num text-6xl font-bold leading-none tracking-[-0.035em]">
                <CountUp value={waiting.length} />
              </div>
              <p className="text-primary-foreground/90 type-small mt-2 max-w-[18ch]">
                Replies and approvals that need a human. Everything else is handled.
              </p>
            </div>
          </div>

          {/* The actual items */}
          <ul className="divide-border bg-surface-2 divide-y">
            {waiting.map((item) => (
              <li key={item.who}>
                <Link
                  href={item.href}
                  className="group hover:bg-card focus-visible:ring-ring/40 flex min-h-20 items-center gap-3.5 px-5 py-4 outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-inset sm:px-6"
                >
                  <Avatar className="size-9 shrink-0">
                    <AvatarFallback className="text-xs">{item.initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="type-body leading-snug">
                      <span className="font-medium">{item.who}</span>{" "}
                      <span className="text-muted-foreground">{item.what}</span>
                    </p>
                    <span className="text-muted-foreground type-meta mt-1 inline-block">
                      {item.when}
                    </span>
                  </div>
                  <span className="text-primary inline-flex items-center gap-1 text-sm font-medium">
                    <span className="hidden sm:inline">Review</span>
                    <ArrowRight className="size-4 transition-transform duration-150 ease-out group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Card>

      {/* Activity + right rail */}
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Lately
              <Badge variant="secondary">Sample preview</Badge>
            </CardTitle>
            <CardDescription>
              A preview of what this feed looks like once lead capture and automations go live.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {activity.map((a, i) => (
              <div key={i}>
                <div className="flex items-start gap-3 py-3">
                  <Avatar className="size-8">
                    <AvatarFallback className="text-xs">{a.initials}</AvatarFallback>
                  </Avatar>
                  <p className="type-body min-w-0 flex-1">
                    <span className="font-medium">{a.who}</span>{" "}
                    <span className="text-muted-foreground">{a.what}</span>
                  </p>
                  <span className="text-muted-foreground type-meta mt-0.5 shrink-0">{a.when}</span>
                </div>
                {i < activity.length - 1 ? <Separator /> : null}
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          {/* Quiet weekly pulse — deliberately not a hero-metric card. */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                This week
                <Badge variant="secondary">Sample preview</Badge>
              </CardTitle>
              <CardDescription>New leads captured for you.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-baseline gap-2">
                <span className="num text-foreground text-3xl font-bold tracking-tight">
                  <CountUp value={24} />
                </span>
                <span className="text-success type-small font-medium">+50% vs last week</span>
              </div>
              <div className="bg-surface-2 divide-border grid grid-cols-2 divide-x rounded-lg border border-border/70">
                <div className="px-3 py-2.5">
                  <span className="num block text-lg font-bold">18</span>
                  <span className="text-muted-foreground type-meta">Followed up</span>
                </div>
                <div className="px-3 py-2.5">
                  <span className="num block text-lg font-bold">6</span>
                  <span className="text-muted-foreground type-meta">Need review</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your toolkit</CardTitle>
              <CardDescription>Four helpers, working in the background.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              {products.map((p) => (
                <Link
                  key={p.name}
                  href={p.href}
                  className="group hover:bg-accent focus-visible:ring-ring/40 -mx-2 flex min-h-14 items-start gap-3 rounded-lg p-2 outline-none transition-colors focus-visible:ring-[3px]"
                >
                  <span className="bg-secondary text-foreground flex size-9 shrink-0 items-center justify-center rounded-md border border-border [&>svg]:size-4.5">
                    <p.icon />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1 text-sm font-medium">
                      {p.name}
                      <ArrowUpRight className="text-muted-foreground/70 size-3.5 transition-transform duration-150 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </span>
                    <span className="text-muted-foreground type-small block">{p.blurb}</span>
                  </span>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <Link
        href="/automations"
        className={cn(buttonVariants({ variant: "outline" }), "w-full sm:hidden")}
      >
        Set up an automation
      </Link>
    </>
  );
}
