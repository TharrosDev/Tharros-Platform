"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, CreditCard, LogOut, Search, Settings } from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Kbd } from "@/components/ui/kbd";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/components/ui/toast";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { MobileNav } from "@/components/shell/mobile-nav";
import { CommandPalette } from "@/components/shell/command-palette";
import { demoUser } from "@/components/shell/nav";

function Topbar() {
  const [cmdOpen, setCmdOpen] = React.useState(false);
  const toast = useToast();

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
    <header className="bg-background/80 sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/60 px-4 backdrop-blur sm:px-6">
      <MobileNav />

      <button
        type="button"
        onClick={() => setCmdOpen(true)}
        className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/40 flex h-9 flex-1 items-center gap-2.5 rounded-lg border border-border/60 px-3 text-sm outline-none transition-colors focus-visible:ring-[3px] sm:max-w-72 sm:flex-initial"
      >
        <Search className="size-4 shrink-0" />
        <span className="hidden truncate sm:inline">Search or jump to…</span>
        <Kbd className="ml-auto hidden sm:inline-flex">⌘K</Kbd>
      </button>

      <div className="ml-auto flex items-center gap-2">
        <Badge variant="default" className="hidden gap-1.5 sm:flex">
          <span className="bg-primary size-1.5 rounded-full" />
          Local &amp; Canadian
        </Badge>
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
              <AvatarFallback className="text-xs">
                {demoUser.initials}
              </AvatarFallback>
            </Avatar>
            <ChevronDown className="text-muted-foreground hidden size-4 sm:block" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>
              {demoUser.name}
              <span className="text-muted-foreground block text-xs font-normal">
                {demoUser.company}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/settings" />}>
              <Settings />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/billing" />}>
              <CreditCard />
              Billing
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() =>
                toast.add({
                  title: "Sign-in lands soon",
                  description: "Accounts arrive in a later phase.",
                })
              }
            >
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
    </header>
  );
}

export { Topbar };
