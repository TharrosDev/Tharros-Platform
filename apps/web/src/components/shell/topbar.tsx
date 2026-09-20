"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, CreditCard, LogOut, Search, Settings, User } from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Kbd } from "@/components/ui/kbd";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { MobileNav } from "@/components/shell/mobile-nav";
import { Breadcrumbs } from "@/components/shell/breadcrumbs";
import { CommandPalette } from "@/components/shell/command-palette";
import { NotificationMenu } from "@/components/shell/notification-menu";
import { signOut } from "@/lib/auth/actions";
import type { DisplayUser } from "@/lib/auth/user";
import type { UserOrg } from "@/lib/org/queries";
import type { Notification } from "@/lib/notifications/types";

function Topbar({
  user,
  orgs,
  activeOrg,
  notifications,
  unreadCount,
}: {
  user: DisplayUser;
  orgs: UserOrg[];
  activeOrg: UserOrg | null;
  notifications: Notification[];
  unreadCount: number;
}) {
  const [cmdOpen, setCmdOpen] = React.useState(false);

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCmdOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <header className="on-rack seam-b z-topbar h-topbar sticky top-0 flex items-center gap-2 px-3 sm:px-6">
      <MobileNav user={user} orgs={orgs} activeOrg={activeOrg} />

      <Breadcrumbs className="min-w-0 flex-1" />

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={() => setCmdOpen(true)}
          className="text-muted-foreground hover:text-foreground bg-rack-deep border-rack-edge type-strip h-control-sm hover:border-rack-foreground/40 flex items-center gap-2 border px-2.5 transition-colors lg:w-72"
          aria-label="Search or jump to"
        >
          <Search className="size-4 shrink-0" aria-hidden />
          <span className="hidden truncate lg:inline">Search or jump to…</span>
          <Kbd className="ml-auto hidden lg:inline-flex">⌘K</Kbd>
        </button>
        <NotificationMenu notifications={notifications} unreadCount={unreadCount} />

        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "gap-2 px-1.5 normal-case",
            )}
            aria-label="Open account menu"
          >
            <Avatar className="size-6 border-rack-edge">
              <AvatarImage src={user.avatarUrl ?? undefined} alt="" />
              <AvatarFallback>{user.initials}</AvatarFallback>
            </Avatar>
            <span className="type-strip hidden max-w-36 truncate xl:block">
              {activeOrg?.name ?? user.name}
            </span>
            <ChevronDown className="text-muted-foreground hidden size-4 sm:block" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>
              {user.name}
              <span className="text-muted-foreground block truncate text-xs font-normal">
                {user.email}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/profile" />}>
              <User />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/settings" />}>
              <Settings />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/billing" />}>
              <CreditCard />
              Billing
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <form action={signOut}>
              <DropdownMenuItem render={<button type="submit" className="w-full" />}>
                <LogOut />
                Sign out
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
    </header>
  );
}

export { Topbar };
