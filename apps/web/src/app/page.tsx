import {
  ArrowUpRight,
  CreditCard,
  LayoutGrid,
  Plus,
  Settings,
  Sparkles,
  Users,
  Workflow,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { ThemeToggle } from "@/components/theme-toggle";
import { TharrosWordmark } from "@/components/brand/logo";

const nav = [
  { label: "Dashboard", icon: LayoutGrid, active: true },
  { label: "AI Assistant", icon: Sparkles },
  { label: "Lead Capture", icon: Users, badge: "3 new" },
  { label: "Automations", icon: Workflow },
];

const footerNav = [
  { label: "Settings", icon: Settings },
  { label: "Billing", icon: CreditCard },
];

const products = [
  {
    name: "AI Assistant",
    blurb: "Answers your customers in plain language, day or night.",
    icon: Sparkles,
  },
  {
    name: "Lead Capture",
    blurb: "Catches every enquiry and follows up so none slip away.",
    icon: Users,
  },
  {
    name: "Automations",
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

export default function Home() {
  return (
    <div className="bg-background flex min-h-screen">
      {/* Sidebar */}
      <aside className="bg-card/60 hidden w-64 shrink-0 flex-col border-r border-border/60 px-3 py-5 lg:flex">
        <div className="px-2">
          <TharrosWordmark />
        </div>

        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {nav.map((item) => (
            <NavLink key={item.label} {...item} />
          ))}

          <div className="mt-auto flex flex-col gap-1">
            <Separator className="my-3" />
            {footerNav.map((item) => (
              <NavLink key={item.label} {...item} />
            ))}
          </div>
        </nav>

        <Separator className="my-3" />
        <div className="flex items-center gap-3 px-2 py-1">
          <Avatar>
            <AvatarFallback>MA</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">Magnus Abdelnour</p>
            <p className="text-muted-foreground truncate text-xs">Glebe Candle Co.</p>
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="flex h-16 items-center justify-between gap-4 border-b border-border/60 px-5 sm:px-8">
          <Badge variant="default" className="gap-1.5">
            <span className="bg-primary size-1.5 rounded-full" />
            Local &amp; Canadian
          </Badge>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Avatar className="size-8 lg:hidden">
              <AvatarFallback className="text-xs">MA</AvatarFallback>
            </Avatar>
          </div>
        </header>

        {/* Content */}
        <main className="mx-auto w-full max-w-5xl flex-1 space-y-8 px-5 py-8 sm:px-8 sm:py-10">
          <PageHeader
            title={
              <span>
                Hey Magnus <span aria-hidden>👋</span>
              </span>
            }
            description="Here is what Tharros looked after for you. Nothing needs you right this second, but a couple of things are waiting when you have a minute."
            actions={
              <Button size="lg">
                <Plus />
                New automation
              </Button>
            }
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
                  <button
                    key={p.name}
                    type="button"
                    className="group hover:bg-accent flex w-full items-start gap-3 rounded-lg p-2.5 text-left transition-colors"
                  >
                    <span className="bg-primary-soft text-primary-soft-foreground flex size-9 shrink-0 items-center justify-center rounded-lg [&>svg]:size-4.5">
                      <p.icon />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1 text-sm font-medium">
                        {p.name}
                        <ArrowUpRight className="text-muted-foreground size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                      </span>
                      <span className="text-muted-foreground type-small block">{p.blurb}</span>
                    </span>
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}

function NavLink({
  label,
  icon: Icon,
  active,
  badge,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active?: boolean;
  badge?: string;
}) {
  return (
    <a
      href="#"
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary-soft text-primary-soft-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      <Icon className="size-4.5 shrink-0" />
      <span className="flex-1">{label}</span>
      {badge ? (
        <Badge variant={active ? "solid" : "secondary"} className="px-2 py-0 text-[0.625rem]">
          {badge}
        </Badge>
      ) : null}
    </a>
  );
}
