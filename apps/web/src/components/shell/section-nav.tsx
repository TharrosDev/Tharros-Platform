"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { m } from "motion/react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { spring } from "@/components/motion";

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
 * Shared section sub-nav. Horizontal: a scrollable underline tab rail whose
 * cobalt indicator slides between items. `orientation="responsive"` becomes a
 * vertical list on lg+ (settings), with a soft pill for the current page.
 */
export function SectionNav({
  items,
  ariaLabel,
  ns,
  orientation = "horizontal",
}: {
  items: SectionNavItem[];
  ariaLabel: string;
  /** Namespaces the sliding indicator so multiple rails can coexist. */
  ns: string;
  orientation?: "horizontal" | "responsive";
}) {
  const pathname = usePathname();
  const vertical = orientation === "responsive";

  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        "-mx-4 flex gap-1 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0",
        vertical && "lg:flex-col lg:gap-px lg:overflow-visible lg:border-b-0",
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
              "focus-visible:ring-ring/40 relative flex min-h-10 shrink-0 items-center gap-2 px-2.5 text-sm outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-inset",
              vertical && "lg:min-h-9 lg:rounded-md",
              active
                ? cn("font-semibold", danger ? "text-destructive" : "text-foreground")
                : cn(
                    "text-muted-foreground hover:text-foreground font-medium",
                    vertical && "lg:hover:bg-accent",
                    danger && "text-destructive/85 hover:text-destructive",
                  ),
            )}
          >
            {active ? (
              <m.span
                layoutId={`section-indicator-${ns}`}
                transition={spring.snappy}
                aria-hidden
                className={cn(
                  "absolute inset-x-2 -bottom-px h-0.5 rounded-full",
                  danger ? "bg-destructive" : "bg-primary",
                  vertical &&
                    cn(
                      "lg:inset-0 lg:h-auto lg:rounded-md",
                      danger ? "lg:bg-destructive/10" : "lg:bg-accent",
                    ),
                )}
              />
            ) : null}
            {Icon ? <Icon className="relative size-4 shrink-0" aria-hidden /> : null}
            <span className="relative whitespace-nowrap">{label}</span>
            {badge ? (
              <span className="bg-primary text-primary-foreground num relative inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1 text-[0.625rem] font-semibold">
                {badge > 9 ? "9+" : badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
