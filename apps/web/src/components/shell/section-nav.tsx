"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { m } from "motion/react";

import { cn } from "@/lib/utils";
import { spring } from "@/components/motion";
import type { NavIcon } from "@/components/shell/nav";

export type SectionNavItem = {
  href: string;
  label: string;
  icon?: NavIcon;
  /** Destructive section (e.g. danger zone): signal red instead of press black. */
  danger?: boolean;
  /** Small count tab (e.g. pending approvals). Omitted when 0. */
  badge?: number;
  /** Match only the exact pathname (for a section's index page). */
  exact?: boolean;
};

/**
 * Bay selectors. Horizontal: a scrollable rail of bay labels with a heavy
 * press-black rule struck under the open bay. `orientation="responsive"`
 * becomes a vertical list on lg+ (settings), where the open bay is a seated
 * strip instead.
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
        "-mx-4 flex gap-0 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0",
        vertical && "lg:flex-col lg:overflow-visible lg:border-b-0",
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
              "min-h-control-lg type-meta relative flex shrink-0 items-center gap-2 px-3 transition-colors",
              active
                ? cn("font-semibold", danger ? "text-destructive" : "text-foreground")
                : cn(
                    "text-muted-foreground hover:text-foreground",
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
                  "absolute inset-x-0 bottom-0 h-0.5",
                  danger ? "bg-destructive" : "bg-foreground",
                  vertical &&
                    cn("lg:inset-0 lg:h-auto", danger ? "lg:bg-destructive/12" : "lg:bg-primary"),
                )}
              />
            ) : null}
            {Icon ? <Icon className="relative size-4 shrink-0" aria-hidden /> : null}
            <span
              className={cn(
                "relative whitespace-nowrap",
                active && vertical && "lg:text-primary-foreground",
              )}
            >
              {label}
            </span>
            {badge ? (
              <span
                className={cn(
                  "bg-destructive text-destructive-foreground num relative inline-flex h-4.5 min-w-4.5 items-center justify-center px-1 text-[0.6875rem] font-semibold",
                  active && vertical && "lg:bg-primary-edge lg:text-primary-soft-foreground",
                )}
              >
                {badge > 9 ? "9+" : badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
