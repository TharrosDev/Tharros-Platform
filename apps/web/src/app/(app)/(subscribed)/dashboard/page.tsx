import Link from "next/link";
import { ArrowRight, ArrowUpRight, Sparkles, Users, Workflow } from "lucide-react";

import { getAuthUser } from "@/lib/auth/current-user";
import { getDisplayUser } from "@/lib/auth/user";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { NewAutomationButton } from "@/components/shell/new-automation-button";

const products = [
  {
    name: "AI Assistant",
    href: "/assistant",
    blurb: "Answers your customers in plain language, day or night.",
    icon: Sparkles,
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
  { who: "Rideau Dental", what: "got an after-hours reply from your assistant", when: "1h ago", initials: "RD" },
  { who: "Maverick Coffee", what: "added 3 new leads from the contact form", when: "3h ago", initials: "MC" },
  { who: "Hintonburg Bakery", what: "finished the welcome follow-up", when: "Yesterday", initials: "HB" },
  { who: "Glebe Physio", what: "booked 2 appointments overnight", when: "Yesterday", initials: "GP" },
];

const sparkline = [5, 8, 6, 11, 9, 14, 18, 24];

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
      <Card className="overflow-hidden p-0">
        <div className="grid gap-px sm:grid-cols-[minmax(0,15rem)_1fr]">
          {/* Count rail */}
          <div className="bg-primary text-primary-foreground flex flex-col justify-between gap-6 p-5 sm:p-6">
            <div className="type-meta text-primary-foreground/80">Waiting on you</div>
            <div>
              <div className="num text-5xl font-bold leading-none tracking-tight">
                {waiting.length}
              </div>
              <p className="text-primary-foreground/85 type-small mt-2 max-w-[18ch]">
                Replies and approvals that need a human. Everything else is handled.
              </p>
            </div>
          </div>

          {/* The actual items */}
          <ul className="divide-border bg-card divide-y">
            {waiting.map((item) => (
              <li key={item.who}>
                <Link
                  href={item.href}
                  className="group hover:bg-accent focus-visible:ring-ring/40 flex items-center gap-3.5 px-5 py-3.5 outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-inset sm:px-6"
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
            <CardTitle>Lately</CardTitle>
            <CardDescription>What Tharros has been doing on its own.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {activity.map((a, i) => (
              <div key={i}>
                <div className="flex items-center gap-3 py-2.5">
                  <Avatar className="size-8">
                    <AvatarFallback className="text-xs">{a.initials}</AvatarFallback>
                  </Avatar>
                  <p className="type-body min-w-0 flex-1">
                    <span className="font-medium">{a.who}</span>{" "}
                    <span className="text-muted-foreground">{a.what}</span>
                  </p>
                  <span className="text-muted-foreground type-meta shrink-0">{a.when}</span>
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
              <CardTitle>This week</CardTitle>
              <CardDescription>New leads captured for you.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-baseline gap-2">
                <span className="num text-foreground text-3xl font-bold tracking-tight">24</span>
                <span className="text-success type-small font-medium">+50% vs last week</span>
              </div>
              <div className="flex h-10 items-end gap-1" aria-hidden="true">
                {sparkline.map((n, i) => (
                  <span
                    key={i}
                    className="bg-primary/30 flex-1 rounded-[2px]"
                    style={{ height: `${(n / 24) * 100}%` }}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your toolkit</CardTitle>
              <CardDescription>Three helpers, working in the background.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              {products.map((p) => (
                <Link
                  key={p.name}
                  href={p.href}
                  className="group hover:bg-accent focus-visible:ring-ring/40 -mx-2 flex items-start gap-3 rounded-md p-2 outline-none transition-colors focus-visible:ring-[3px]"
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
