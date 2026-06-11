"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Wayfinding for pages more than one level deep (/scheduling/calendar,
 * /settings/team, conversation and employee detail pages). Top-level pages
 * render nothing: the sidebar already marks them. Labels come from a static
 * segment map; opaque ids render as "Details".
 */
const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  assistant: "AI Assistant",
  knowledge: "Knowledge",
  scheduling: "Scheduling",
  calendar: "Schedule",
  employees: "Team",
  availability: "Availability",
  conversations: "Conversations",
  analytics: "Analytics",
  activity: "Activity",
  setup: "Setup",
  approvals: "Approvals",
  settings: "Settings",
  organization: "Business profile",
  team: "Team",
  notifications: "Notifications",
  usage: "Usage",
  danger: "Danger zone",
  billing: "Billing",
  subscribe: "Subscribe",
  return: "Checkout",
  profile: "Profile",
  leads: "Lead Capture",
  automations: "Automations",
  admin: "Admin",
  feedback: "Feedback inbox",
};

function labelFor(segment: string): string {
  return SEGMENT_LABELS[segment] ?? "Details";
}

function Breadcrumbs({ className }: { className?: string }) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length < 2) return null;

  const crumbs = segments.map((segment, index) => ({
    label: labelFor(segment),
    href: `/${segments.slice(0, index + 1).join("/")}`,
    last: index === segments.length - 1,
  }));

  return (
    <nav aria-label="Breadcrumb" className={cn("min-w-0", className)}>
      <ol className="flex items-center gap-1 text-sm">
        {crumbs.map((crumb) => (
          <li key={crumb.href} className="flex min-w-0 items-center gap-1">
            {crumb.last ? (
              <span aria-current="page" className="text-foreground truncate font-medium">
                {crumb.label}
              </span>
            ) : (
              <>
                <Link
                  href={crumb.href}
                  className="text-muted-foreground hover:text-foreground truncate transition-colors"
                >
                  {crumb.label}
                </Link>
                <ChevronRight className="text-muted-foreground/60 size-3.5 shrink-0" aria-hidden />
              </>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export { Breadcrumbs };
