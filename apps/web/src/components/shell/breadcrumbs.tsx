"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { allNav, navSections, schedulingNav } from "@/components/shell/nav";

/**
 * Wayfinding. On desktop the full trail; below md, where there is no rail,
 * just the current page, because a phone otherwise had no location indicator
 * at all.
 *
 * Labels are derived from the nav arrays first, so a route cannot be called
 * one thing in the rail and another in the trail. The map below only covers
 * segments that are not nav destinations.
 */
const NAV_LABELS: Record<string, string> = Object.fromEntries(
  [...allNav, ...navSections.flatMap((s) => s.items), ...schedulingNav].map((item) => [
    item.href.split("/").filter(Boolean).at(-1) ?? item.href,
    item.label,
  ]),
);

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
  return NAV_LABELS[segment] ?? SEGMENT_LABELS[segment] ?? "Details";
}

function Breadcrumbs({ className }: { className?: string }) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  const crumbs = segments.map((segment, index) => ({
    label: labelFor(segment),
    href: `/${segments.slice(0, index + 1).join("/")}`,
    last: index === segments.length - 1,
  }));

  return (
    <nav aria-label="Breadcrumb" className={cn("min-w-0", className)}>
      <ol className="flex items-center gap-1.5">
        {crumbs.map((crumb) => (
          <li
            key={crumb.href}
            className={cn(
              "min-w-0 items-center gap-1",
              // Below md there is no rail, so only the current page shows.
              crumb.last ? "flex" : "hidden md:flex",
            )}
          >
            {crumb.last ? (
              <span aria-current="page" className="type-meta text-rack-foreground truncate">
                {crumb.label}
              </span>
            ) : (
              <>
                <Link
                  href={crumb.href}
                  className="type-meta text-rack-muted-foreground hover:bg-accent hover:text-rack-foreground truncate px-1.5 py-1 transition-colors"
                >
                  {crumb.label}
                </Link>
                <ChevronRight
                  className="text-rack-muted-foreground size-3.5 shrink-0"
                  aria-hidden
                />
              </>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export { Breadcrumbs };
