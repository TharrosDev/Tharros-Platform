"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { TharrosWordmark } from "@/components/brand/logo";
import { primaryNav, footerNav, demoUser, type NavItem } from "@/components/shell/nav";

function Sidebar({
  onNavigate,
  className,
}: {
  onNavigate?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex h-full flex-col px-3 py-5", className)}>
      <div className="px-2">
        <TharrosWordmark />
      </div>

      <nav className="mt-8 flex flex-1 flex-col gap-1">
        {primaryNav.map((item) => (
          <NavLink key={item.href} item={item} onNavigate={onNavigate} />
        ))}

        <div className="mt-auto flex flex-col gap-1">
          <Separator className="my-3 bg-sidebar-border" />
          {footerNav.map((item) => (
            <NavLink key={item.href} item={item} onNavigate={onNavigate} />
          ))}
        </div>
      </nav>

      <Separator className="my-3" />
      <div className="flex items-center gap-3 px-2 py-1">
        <Avatar>
          <AvatarFallback>{demoUser.initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{demoUser.name}</p>
          <p className="text-sidebar-muted-foreground truncate text-xs">{demoUser.company}</p>
        </div>
      </div>
    </div>
  );
}

function NavLink({
  item,
  onNavigate,
}: {
  item: NavItem;
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
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-muted-foreground hover:bg-white/5 hover:text-sidebar-foreground",
      )}
    >
      <Icon className="size-4.5 shrink-0" />
      <span className="flex-1">{item.label}</span>
      {item.badge ? (
        <Badge
          variant="solid"
          className="px-2 py-0 text-[0.625rem]"
        >
          {item.badge}
        </Badge>
      ) : null}
    </Link>
  );
}

export { Sidebar };
