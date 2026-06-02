import type { Metadata } from "next";
import Link from "next/link";
import {
  Bell,
  Building2,
  ChevronRight,
  TriangleAlert,
  Users,
  type LucideIcon,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Settings" };

const SETTINGS_LINKS: {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  tone?: "default" | "danger";
}[] = [
  {
    href: "/settings/organization",
    icon: Building2,
    title: "Business profile",
    description: "Your business name, industry, and team size.",
  },
  {
    href: "/settings/team",
    icon: Users,
    title: "Team",
    description: "Invite teammates, assign roles, and manage access.",
  },
  {
    href: "/settings/notifications",
    icon: Bell,
    title: "Notifications",
    description: "Choose which emails your workspace sends.",
  },
  {
    href: "/settings/danger",
    icon: TriangleAlert,
    title: "Danger zone",
    description: "Delete this organization or your account.",
    tone: "danger",
  },
];

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage your workspace, team, and account."
      />

      <div className="space-y-3">
        {SETTINGS_LINKS.map(({ href, icon: Icon, title, description, tone }) => (
          <Link
            key={href}
            href={href}
            className="bg-card shadow-card hover:bg-muted/40 focus-visible:ring-ring/40 flex items-center gap-4 rounded-lg border border-border p-4 transition-colors outline-none focus-visible:ring-[3px]"
          >
            <span
              className={
                tone === "danger"
                  ? "bg-destructive/10 text-destructive flex size-10 shrink-0 items-center justify-center rounded-md"
                  : "bg-primary-soft text-primary-soft-foreground flex size-10 shrink-0 items-center justify-center rounded-md"
              }
            >
              <Icon className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-foreground block font-medium">{title}</span>
              <span className="text-muted-foreground block text-sm">{description}</span>
            </span>
            <ChevronRight className="text-muted-foreground size-5 shrink-0" />
          </Link>
        ))}
      </div>
    </>
  );
}
