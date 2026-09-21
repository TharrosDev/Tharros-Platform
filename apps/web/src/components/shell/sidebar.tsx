"use client";

import * as React from "react";
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

/*
  The rack rail. Section names are engraved into the chrome, and the current
  page is a hi-vis strip seated in its slot: the same object that carries work
  on the board, used here to carry place.
*/
function Sidebar({
  user,
  orgs,
  activeOrg,
  onNavigate,
  className,
  /**
   * Namespaces the sliding seated-strip layoutId. The desktop rail and the
   * mobile drawer are both mounted at once; without distinct namespaces the
   * strip would animate between the two copies.
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
  const navRef = React.useRef<HTMLElement>(null);
  const pathname = usePathname();

  // Keep the current item inside the rail on screens too short to show it all.
  // Scrolls the rail itself, never the page.
  React.useEffect(() => {
    const nav = navRef.current;
    const item = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !item) return;
    const top = item.offsetTop - nav.offsetTop;
    const bottom = top + item.offsetHeight;
    if (top < nav.scrollTop || bottom > nav.scrollTop + nav.clientHeight) {
      nav.scrollTop = Math.max(0, top - nav.clientHeight / 2 + item.offsetHeight / 2);
    }
  }, [pathname]);

  const sections = showAdmin
    ? [
        ...navSections,
        {
          label: "Admin",
          items: [{ label: "Feedback inbox", href: "/admin/feedback", icon: Inbox }],
        },
      ]
    : navSections;

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* The nameplate, screwed to the top of the rack. */}
      <div className="seam-b h-topbar flex shrink-0 items-center px-4">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          aria-label="Tharros dashboard"
          className="-ml-1 inline-flex items-center px-1 py-1"
        >
          <TharrosWordmark markClassName="size-6" />
        </Link>
      </div>

      <div className="px-3 pt-3">
        <OrgSwitcher orgs={orgs} activeOrg={activeOrg} />
      </div>

      <nav
        ref={navRef}
        aria-label="Main"
        className="mt-4 flex flex-1 flex-col gap-4 overflow-y-auto px-3 pb-4"
      >
        {sections.map((section) => (
          <div key={section.label}>
            <p className="type-meta text-rack-muted-foreground px-2 pb-1.5">{section.label}</p>
            <ul className="flex flex-col">
              {section.items.map((item) => (
                <li key={item.href}>
                  <NavLink item={item} ns={ns} onNavigate={onNavigate} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="seam-t flex items-center gap-2.5 px-4 py-3">
        <Avatar>
          <AvatarImage src={user.avatarUrl ?? undefined} alt="" />
          <AvatarFallback>{user.initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="type-strip truncate">{user.name}</p>
          <p className="text-rack-muted-foreground type-small truncate">{user.email}</p>
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
        "min-h-control-lg relative flex items-center gap-2.5 px-2 transition-colors lg:min-h-9",
        active
          ? "text-sidebar-accent-foreground"
          : "text-rack-muted-foreground hover:bg-accent hover:text-rack-foreground",
      )}
    >
      {active ? (
        <m.span
          layoutId={`nav-strip-${ns}`}
          transition={spring.snappy}
          className="bg-sidebar-accent absolute inset-0"
          aria-hidden
        />
      ) : null}
      <Icon className="relative size-4 shrink-0" />
      <span className={cn("type-strip relative flex-1 truncate", active && "font-semibold")}>
        {item.label}
      </span>
    </Link>
  );
}

export { Sidebar };
