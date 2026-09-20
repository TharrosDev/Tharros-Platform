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
    <header className="bg-background/95 sticky top-0 z-topbar flex h-14 items-center gap-2 border-b px-3 sm:px-6">
      <MobileNav user={user} orgs={orgs} activeOrg={activeOrg} />

      <Breadcrumbs className="hidden min-w-0 flex-1 md:block" />

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={() => setCmdOpen(true)}
          className="text-muted-foreground hover:text-foreground bg-card flex h-9 items-center gap-2 rounded-lg border px-2.5 text-sm shadow-xs transition-[color,border-color] hover:border-input lg:w-72"
          aria-label="Search or jump to"
        >
          <Search className="size-4 shrink-0" aria-hidden />
          <span className="hidden truncate lg:inline">Search or jump to…</span>
          <Kbd className="ml-auto hidden lg:inline-flex">⌘K</Kbd>
        </button>
        <NotificationMenu notifications={notifications} unreadCount={unreadCount} />

        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(buttonVariants({ variant: "ghost" }), "h-9 gap-2 px-1.5")}
            aria-label="Open account menu"
          >
            <Avatar className="size-6">
              <AvatarImage src={user.avatarUrl ?? undefined} alt="" />
              <AvatarFallback className="text-[0.625rem]">{user.initials}</AvatarFallback>
            </Avatar>
            <span className="hidden max-w-36 truncate text-sm font-medium xl:block">
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
