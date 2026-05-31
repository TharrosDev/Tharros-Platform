import Link from "next/link";
import { ArrowUpRight, Sparkles, Users, Workflow } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
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
    blurb: "Quietly handles the busywork between the tools you already use.",
    icon: Workflow,
  },
];

const activity = [
  { who: "Capital Plumbing", what: "booked a callback for Thursday", when: "2m ago", initials: "CP" },
  { who: "Rideau Dental", what: "got an after-hours reply from your assistant", when: "1h ago", initials: "RD" },
  { who: "Maverick Coffee", what: "added 3 new leads from the contact form", when: "3h ago", initials: "MC" },
  { who: "Hintonburg Bakery", what: "finished the welcome follow-up", when: "Yesterday", initials: "HB" },
];

const sparkline = [5, 8, 6, 11, 9, 14, 18, 24];

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title={
          <span>
            Hey Magnus <span aria-hidden>👋</span>
          </span>
        }
        description="Here is what Tharros looked after for you. Nothing needs you right this second, but a couple of things are waiting when you have a minute."
        actions={<NewAutomationButton />}
      />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="New leads this week"
          value="24"
          hint="Up from 16 last week"
          icon={<Users />}
        >
          <div className="flex h-12 items-end gap-1.5">
            {sparkline.map((n, i) => (
              <span
                key={i}
                className="bg-primary/25 hover:bg-primary/45 flex-1 rounded-sm transition-colors"
                style={{ height: `${(n / 24) * 100}%` }}
              />
            ))}
          </div>
        </StatCard>

        <StatCard
          label="Waiting on you"
          value="8"
          hint="Replies and approvals"
          icon={<Sparkles />}
        >
          <div className="flex items-center gap-1.5 pt-1">
            {Array.from({ length: 12 }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  "size-2.5 rounded-full",
                  i < 8 ? "bg-primary" : "bg-muted",
                )}
              />
            ))}
          </div>
        </StatCard>
      </div>

      {/* Activity + products */}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Lately</CardTitle>
            <CardDescription>A quick look at what has been happening.</CardDescription>
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
                  <span className="text-muted-foreground type-small shrink-0">{a.when}</span>
                </div>
                {i < activity.length - 1 ? <Separator /> : null}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your toolkit</CardTitle>
            <CardDescription>Three helpers, all working in the background.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {products.map((p) => (
              <Link
                key={p.name}
                href={p.href}
                className="group hover:bg-accent focus-visible:ring-ring/40 flex w-full items-start gap-3 rounded-lg p-2.5 text-left outline-none transition-colors focus-visible:ring-[3px]"
              >
                <span className="bg-primary-soft text-primary-soft-foreground flex size-9 shrink-0 items-center justify-center rounded-lg [&>svg]:size-4.5">
                  <p.icon />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 text-sm font-medium">
                    {p.name}
                    <ArrowUpRight className="text-muted-foreground size-3.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
                  </span>
                  <span className="text-muted-foreground type-small block">{p.blurb}</span>
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
