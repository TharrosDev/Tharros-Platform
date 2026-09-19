"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { m } from "motion/react";
import { Inbox } from "lucide-react";

import { cn } from "@/lib/utils";
import { spring } from "@/components/motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TharrosWordmark } from "@/components/brand/logo";
import { OrgSwitcher } from "@/components/shell/org-switcher";
import { navSections, type NavItem } from "@/components/shell/nav";
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
  /** Platform admin (email allowlist): shows the cross-org admin section. */
  showAdmin = false,
}: {
  user: DisplayUser;
  orgs: UserOrg[];
  activeOrg: UserOrg | null;
  onNavigate?: () => void;
  className?: string;
  ns?: string;
  showAdmin?: boolean;
}) {
  const sections = showAdmin
    ? [...navSections, { label: "Admin", items: [{ label: "Feedback inbox", href: "/admin/feedback", icon: Inbox }] }]
    : navSections;

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <div className="flex h-14 shrink-0 items-center px-4">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          aria-label="Tharros dashboard"
          className="focus-visible:ring-ring/40 -ml-1 inline-flex items-center rounded-md px-1 py-1 outline-none focus-visible:ring-[3px]"
        >
          <TharrosWordmark markClassName="size-6" />
        </Link>
      </div>

      <div className="px-3">
        <OrgSwitcher orgs={orgs} activeOrg={activeOrg} />
      </div>

      <nav aria-label="Main" className="mt-4 flex flex-1 flex-col gap-5 overflow-y-auto px-3 pb-4">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="type-meta text-muted-foreground/80 px-2.5 pb-1.5">{section.label}</p>
            <ul className="flex flex-col gap-px">
              {section.items.map((item) => (
                <li key={item.href}>
                  <NavLink item={item} ns={ns} onNavigate={onNavigate} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-sidebar-border flex items-center gap-2.5 border-t px-4 py-3">
        <Avatar>
          <AvatarImage src={user.avatarUrl ?? undefined} alt="" />
          <AvatarFallback>{user.initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="text-muted-foreground truncate text-xs">{user.email}</p>
        </div>
      </div>
    </div>
  );
}

function NavLink({ item, ns, onNavigate }: { item: NavItem; ns: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "focus-visible:ring-sidebar-ring/40 relative flex min-h-9 items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm outline-none transition-colors focus-visible:ring-[3px]",
        active
          ? "text-sidebar-accent-foreground font-semibold"
          : "text-sidebar-muted-foreground hover:bg-accent hover:text-sidebar-foreground font-medium",
      )}
    >
      {active ? (
        <m.span
          layoutId={`nav-pill-${ns}`}
          transition={spring.snappy}
          className="bg-sidebar-accent absolute inset-0 rounded-md"
          aria-hidden
        />
      ) : null}
      <Icon className="relative size-4 shrink-0" />
      <span className="relative flex-1 truncate">{item.label}</span>
    </Link>
  );
}

export { Sidebar };
