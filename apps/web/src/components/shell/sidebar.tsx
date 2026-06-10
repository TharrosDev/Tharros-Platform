"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { m } from "motion/react";

import { cn } from "@/lib/utils";
import { spring } from "@/components/motion";
import { AnimateHeight } from "@/components/motion";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TharrosWordmark } from "@/components/brand/logo";
import { OrgSwitcher } from "@/components/shell/org-switcher";
import { navSections, schedulingNav, type NavItem } from "@/components/shell/nav";
import type { DisplayUser } from "@/lib/auth/user";
import type { UserOrg } from "@/lib/org/queries";

function Sidebar({
  user,
  orgs,
  activeOrg,
  onNavigate,
  className,
  /**
   * Namespaces the sliding active-pill layoutId. The desktop sidebar and the
   * mobile drawer are both mounted at once; without distinct namespaces the
   * pill would animate between the two copies.
   */
  ns = "desktop",
}: {
  user: DisplayUser;
  orgs: UserOrg[];
  activeOrg: UserOrg | null;
  onNavigate?: () => void;
  className?: string;
  ns?: string;
}) {
  const pathname = usePathname();
  const inScheduling = pathname.startsWith("/scheduling");

  return (
    <div className={cn("flex h-full flex-col px-3 py-5", className)}>
      <div className="px-2">
        <TharrosWordmark />
      </div>

      <div className="mt-6">
        <OrgSwitcher orgs={orgs} activeOrg={activeOrg} />
      </div>

      <nav className="mt-6 flex flex-1 flex-col overflow-y-auto">
        {navSections.map((section, index) => (
          <div key={section.label} className={cn(index > 0 && "mt-6")}>
            <p className="type-meta text-sidebar-muted-foreground/70 px-3 pb-2">
              {section.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => (
                <div key={item.href}>
                  <NavLink item={item} ns={ns} onNavigate={onNavigate} />
                  {item.href === "/scheduling" ? (
                    <AnimateHeight open={inScheduling}>
                      <div className="flex flex-col gap-0.5 py-1 pl-5">
                        {schedulingNav.map((sub) => (
                          <SubNavLink key={sub.href} item={sub} onNavigate={onNavigate} />
                        ))}
                      </div>
                    </AnimateHeight>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <Separator className="my-3 bg-sidebar-border" />
      <div className="flex items-center gap-3 px-2 py-1">
        <Avatar>
          <AvatarImage src={user.avatarUrl ?? undefined} alt="" />
          <AvatarFallback>{user.initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="text-sidebar-muted-foreground truncate text-xs">
            {user.email}
          </p>
        </div>
      </div>
    </div>
  );
}

function NavLink({
  item,
  ns,
  onNavigate,
}: {
  item: NavItem;
  ns: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "text-sidebar-accent-foreground"
          : "text-sidebar-muted-foreground hover:bg-white/5 hover:text-sidebar-foreground",
      )}
    >
      {active ? (
        <m.span
          layoutId={`nav-pill-${ns}`}
          transition={spring.snappy}
          className="bg-sidebar-accent absolute inset-0 rounded-lg"
          aria-hidden
        />
      ) : null}
      <Icon className="relative size-4.5 shrink-0" />
      <span className="relative flex-1">{item.label}</span>
      {item.soon ? (
        <Badge
          variant="outline"
          className={cn(
            "relative border-white/15 px-1.5 py-0 text-[0.625rem]",
            active ? "text-sidebar-accent-foreground/80" : "text-sidebar-muted-foreground",
          )}
        >
          Soon
        </Badge>
      ) : null}
    </Link>
  );
}

function SubNavLink({
  item,
  onNavigate,
}: {
  item: NavItem;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active =
    item.href === "/scheduling"
      ? pathname === "/scheduling"
      : pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-md px-3 py-1.5 text-[0.8125rem] transition-colors",
        active
          ? "bg-white/10 font-medium text-sidebar-foreground"
          : "text-sidebar-muted-foreground hover:bg-white/5 hover:text-sidebar-foreground",
      )}
    >
      {item.label}
    </Link>
  );
}

export { Sidebar };
