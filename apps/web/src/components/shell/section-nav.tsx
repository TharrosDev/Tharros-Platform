"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { m } from "motion/react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { spring } from "@/components/motion";
import { Badge } from "@/components/ui/badge";

export type SectionNavItem = {
  href: string;
  label: string;
  icon?: LucideIcon;
  /** Destructive section (e.g. danger zone): tinted red instead of cobalt. */
  danger?: boolean;
  /** Small count badge (e.g. pending approvals). Omitted when 0. */
  badge?: number;
  /** Match only the exact pathname (for a section's index page). */
  exact?: boolean;
};

/**
 * Shared section sub-nav: a horizontal, scrollable tab rail by default;
 * `orientation="responsive"` stacks it into a vertical rail on lg+ (settings).
 * The active item carries a soft-cobalt pill that slides between items.
 */
export function SectionNav({
  items,
  ariaLabel,
  ns,
  orientation = "horizontal",
}: {
  items: SectionNavItem[];
  ariaLabel: string;
  /** Namespaces the sliding pill so multiple rails can coexist. */
  ns: string;
  orientation?: "horizontal" | "responsive";
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        "-mx-1 flex gap-1 overflow-x-auto px-1 pb-1",
        orientation === "responsive" && "lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0",
      )}
    >
      {items.map(({ href, label, icon: Icon, danger, badge, exact }) => {
        const active = exact
          ? pathname === href
          : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "focus-visible:ring-ring/40 relative flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px]",
              active
                ? danger
                  ? "text-destructive"
                  : "text-primary-soft-foreground"
                : cn(
                    "text-muted-foreground hover:bg-accent hover:text-foreground",
                    danger && "text-destructive/80 hover:text-destructive",
                  ),
            )}
          >
            {active ? (
              <m.span
                layoutId={`section-pill-${ns}`}
                transition={spring.snappy}
                className={cn(
                  "absolute inset-0 rounded-md",
                  danger ? "bg-destructive/10" : "bg-primary-soft",
                )}
                aria-hidden
              />
            ) : null}
            {Icon ? <Icon className="relative size-4 shrink-0" aria-hidden /> : null}
            <span className="relative whitespace-nowrap">{label}</span>
            {badge ? (
              <Badge variant="solid" className="relative px-1.5 py-0 text-[0.625rem]">
                {badge > 9 ? "9+" : badge}
              </Badge>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
