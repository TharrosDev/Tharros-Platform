"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Building2, Gauge, TriangleAlert, Users, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type Section = {
  href: string;
  label: string;
  icon: LucideIcon;
  danger?: boolean;
};

const SECTIONS: Section[] = [
  { href: "/settings/organization", label: "Business profile", icon: Building2 },
  { href: "/settings/team", label: "Team", icon: Users },
  { href: "/settings/usage", label: "Usage", icon: Gauge },
  { href: "/settings/notifications", label: "Notifications", icon: Bell },
  { href: "/settings/danger", label: "Danger zone", icon: TriangleAlert, danger: true },
];

/**
 * Persistent settings sub-nav. A vertical rail on desktop; a horizontal,
 * scrollable row on mobile. Highlights the active section from the pathname.
 */
export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Settings sections"
      className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0"
    >
      {SECTIONS.map(({ href, label, icon: Icon, danger }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "focus-visible:ring-ring/40 flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px]",
              active
                ? danger
                  ? "bg-destructive/10 text-destructive"
                  : "bg-primary-soft text-primary-soft-foreground"
                : cn(
                    "text-muted-foreground hover:bg-accent hover:text-foreground",
                    danger && "text-destructive/80 hover:text-destructive",
                  ),
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="whitespace-nowrap">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
