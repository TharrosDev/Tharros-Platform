import Link from "next/link";
import { ArrowUpRight, Bell, BookOpen, CalendarDays, Sparkles } from "lucide-react";

import { getAuthUser } from "@/lib/auth/current-user";
import { getDisplayUser } from "@/lib/auth/user";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const workspace = [
  {
    name: "AI Assistant",
    href: "/assistant",
    blurb: "Ask grounded questions and generate work from your business knowledge.",
    icon: Sparkles,
  },
  {
    name: "Workforce Scheduling",
    href: "/scheduling",
    blurb: "Build, review, publish and maintain schedules for your team.",
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
        description="Everything here is connected to a live Tharros product surface."
      />

      <Card className="shadow-raised">
        <CardHeader>
          <CardTitle>Your workspace</CardTitle>
          <CardDescription>
            Open the part of Tharros you need. Operational metrics will only be added when they are
            backed by real organization data.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {workspace.map(({ name, href, blurb, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group bg-surface-2 hover:bg-accent focus-visible:ring-ring/40 rounded-xl border border-border/70 p-5 outline-none transition-colors focus-visible:ring-[3px]"
            >
              <span className="bg-card text-foreground flex size-10 items-center justify-center rounded-lg border border-border">
                <Icon className="size-4.5" aria-hidden />
              </span>
              <span className="mt-5 flex items-center gap-1.5 text-sm font-semibold">
                {name}
                <ArrowUpRight className="text-muted-foreground size-3.5 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </span>
              <span className="text-muted-foreground type-small mt-1 block">{blurb}</span>
            </Link>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
