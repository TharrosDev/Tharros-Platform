"use client";

import { SectionNav, type SectionNavItem } from "@/components/shell/section-nav";
import { schedulingNav } from "@/components/shell/nav";

/**
 * Persistent scheduling section rail, rendered by the scheduling layout on
 * every page in the section.
 *
 * Derived from `schedulingNav` rather than a second hand-kept list: the rail,
 * the command palette and the breadcrumb labels all read the same array, so a
 * route can no longer be reachable from one and invisible to the others.
 */
export function SchedulingSubnav({ pendingApprovals = 0 }: { pendingApprovals?: number }) {
  const items: SectionNavItem[] = schedulingNav.map((item) => ({
    href: item.href,
    label: item.label,
    icon: item.icon,
    exact: item.href === "/scheduling",
    badge: item.href === "/scheduling/approvals" ? pendingApprovals : undefined,
  }));

  return <SectionNav items={items} ariaLabel="Scheduling sections" ns="scheduling" />;
}
