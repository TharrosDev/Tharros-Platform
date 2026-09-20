"use client";

import * as React from "react";
import { Menu } from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Sheet, SheetTrigger, SheetContent } from "@/components/ui/sheet";
import { Sidebar } from "@/components/shell/sidebar";
import type { DisplayUser } from "@/lib/auth/user";
import type { UserOrg } from "@/lib/org/queries";

function MobileNav({
  user,
  orgs,
  activeOrg,
}: {
  user: DisplayUser;
  orgs: UserOrg[];
  activeOrg: UserOrg | null;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "size-9 lg:hidden")}
        aria-label="Open menu"
      >
        <Menu className="size-5" aria-hidden />
      </SheetTrigger>
      <SheetContent
        side="left"
        className="border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
      >
        <Sidebar
          user={user}
          orgs={orgs}
          activeOrg={activeOrg}
          ns="mobile"
          onNavigate={() => setOpen(false)}
        />
      </SheetContent>
    </Sheet>
  );
}

export { MobileNav };
