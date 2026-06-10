"use client";

import {
  Activity,
  BarChart3,
  CalendarDays,
  CalendarRange,
  CheckSquare,
  Clock,
  MessagesSquare,
  Users,
} from "lucide-react";

import { SectionNav, type SectionNavItem } from "@/components/shell/section-nav";

/**
 * Persistent scheduling section rail, rendered by the scheduling layout on
 * every page in the section. Replaces the old hub link-cards and the
 * per-page "Back to scheduling" buttons.
 */
export function SchedulingSubnav({ pendingApprovals = 0 }: { pendingApprovals?: number }) {
  const items: SectionNavItem[] = [
    { href: "/scheduling", label: "Overview", icon: CalendarDays, exact: true },
    { href: "/scheduling/calendar", label: "Schedule", icon: CalendarRange },
    {
      href: "/scheduling/approvals",
      label: "Approvals",
      icon: CheckSquare,
      badge: pendingApprovals,
    },
    { href: "/scheduling/employees", label: "Team", icon: Users },
    { href: "/scheduling/availability", label: "Availability", icon: Clock },
    { href: "/scheduling/conversations", label: "Conversations", icon: MessagesSquare },
    { href: "/scheduling/analytics", label: "Analytics", icon: BarChart3 },
    { href: "/scheduling/activity", label: "Activity", icon: Activity },
  ];

  return <SectionNav items={items} ariaLabel="Scheduling sections" ns="scheduling" />;
}
