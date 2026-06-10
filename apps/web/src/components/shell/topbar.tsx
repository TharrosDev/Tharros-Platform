"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, CreditCard, LogOut, Search, Settings, User } from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Kbd } from "@/components/ui/kbd";
import { ThemeToggle } from "@/components/theme-toggle";
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
    <header className="bg-background/80 sticky top-0 z-topbar flex h-16 items-center gap-3 border-b border-border/60 px-4 backdrop-blur sm:px-6">
      <MobileNav user={user} orgs={orgs} activeOrg={activeOrg} />

      <Breadcrumbs className="hidden min-w-0 flex-1 md:block" />

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={() => setCmdOpen(true)}
          className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/40 flex h-9 items-center gap-2.5 rounded-lg border border-border/60 px-3 text-sm outline-none transition-colors focus-visible:ring-[3px] lg:w-64"
          aria-label="Search or jump to"
        >
          <Search className="size-4 shrink-0" />
          <span className="hidden truncate lg:inline">Search or jump to…</span>
          <Kbd className="ml-auto hidden lg:inline-flex">⌘K</Kbd>
        </button>
        <NotificationMenu notifications={notifications} unreadCount={unreadCount} />
        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "h-9 gap-2 px-1.5",
            )}
            aria-label="Open account menu"
          >
            <Avatar className="size-7">
              <AvatarImage src={user.avatarUrl ?? undefined} alt="" />
              <AvatarFallback className="text-xs">
                {user.initials}
              </AvatarFallback>
            </Avatar>
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
              <DropdownMenuItem
                render={<button type="submit" className="w-full" />}
              >
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
