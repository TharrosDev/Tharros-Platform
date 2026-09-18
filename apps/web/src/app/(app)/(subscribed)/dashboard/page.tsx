import Link from "next/link";
import {
  ArrowUpRight,
  Bell,
  BookOpen,
  CalendarDays,
  Sparkles,
  Workflow,
} from "lucide-react";

import { getAuthUser } from "@/lib/auth/current-user";
import { getDisplayUser } from "@/lib/auth/user";
import { PageHeader } from "@/components/page-header";
import { NewAutomationButton } from "@/components/shell/new-automation-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const shippedProducts = [
  {
    name: "AI Assistant",
    href: "/assistant",
    blurb: "Ask questions and generate work from your business knowledge base.",
    icon: Sparkles,
  },
  {
    name: "Scheduling",
    href: "/scheduling",
    blurb: "Build, review and publish schedules, then handle changes as they happen.",
    icon: CalendarDays,
  },
  {
    name: "Knowledge",
    href: "/knowledge",
    blurb: "Manage the documents that ground your assistant's answers.",
    icon: BookOpen,
  },
  {
    name: "Notifications",
    href: "/notifications",
    blurb: "Review account and operational updates that need your attention.",
    icon: Bell,
  },
];

export default async function DashboardPage() {
  const user = await getAuthUser();
  const firstName = user ? getDisplayUser(user).name.split(/\s+/)[0] : null;

  return (
    <>
      <PageHeader
        title={firstName ? `Welcome back, ${firstName}` : "Welcome back"}
        description="Open a live product area or review what needs attention. Dashboard metrics only appear here when they come from real Tharros data."
        actions={<NewAutomationButton />}
      />

      <div className="grid gap-4 lg:grid-cols-[1.45fr_0.8fr]">
        <Card className="shadow-raised">
          <CardHeader>
            <CardTitle>Workspace</CardTitle>
            <CardDescription>
              The production tools available to your organization today.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {shippedProducts.map(({ name, href, blurb, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="group bg-surface-2 hover:bg-accent focus-visible:ring-ring/40 rounded-xl border border-border/70 p-4 outline-none transition-colors focus-visible:ring-[3px]"
              >
                <span className="bg-card text-foreground flex size-10 items-center justify-center rounded-lg border border-border">
                  <Icon className="size-4.5" aria-hidden />
                </span>
                <span className="mt-4 flex items-center gap-1.5 text-sm font-semibold">
                  {name}
                  <ArrowUpRight className="text-muted-foreground size-3.5 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </span>
                <span className="text-muted-foreground type-small mt-1 block">{blurb}</span>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Coming next</CardTitle>
              <Badge variant="outline">Roadmap</Badge>
            </div>
            <CardDescription>
              These areas are visible for transparency, but are not included as shipped plan
              capabilities yet.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link
              href="/leads"
              className="hover:bg-accent focus-visible:ring-ring/40 flex items-start gap-3 rounded-lg p-3 outline-none transition-colors focus-visible:ring-[3px]"
            >
              <span className="bg-secondary flex size-9 shrink-0 items-center justify-center rounded-md border border-border">
                <Sparkles className="size-4" aria-hidden />
              </span>
              <span>
                <span className="block text-sm font-medium">Lead Capture</span>
                <span className="text-muted-foreground type-small">
                  Capture, triage and follow-up workflows are still under development.
                </span>
              </span>
            </Link>
            <Link
              href="/automations"
              className="hover:bg-accent focus-visible:ring-ring/40 flex items-start gap-3 rounded-lg p-3 outline-none transition-colors focus-visible:ring-[3px]"
            >
              <span className="bg-secondary flex size-9 shrink-0 items-center justify-center rounded-md border border-border">
                <Workflow className="size-4" aria-hidden />
              </span>
              <span>
                <span className="block text-sm font-medium">Automations</span>
                <span className="text-muted-foreground type-small">
                  External connectors and workflow execution are not production-ready yet.
                </span>
              </span>
            </Link>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
