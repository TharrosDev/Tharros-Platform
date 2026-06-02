"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, ChevronsUpDown, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { OrgFields } from "@/components/org/org-fields";
import { FormMessage } from "@/components/auth/auth-card";
import { createOrganization, switchOrg } from "@/lib/org/actions";
import type { UserOrg } from "@/lib/org/queries";

export function OrgSwitcher({
  orgs,
  activeOrg,
}: {
  orgs: UserOrg[];
  activeOrg: UserOrg | null;
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function handleSwitch(orgId: string) {
    if (orgId === activeOrg?.id) return;
    startTransition(async () => {
      await switchOrg(orgId);
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left outline-none transition-colors",
            "hover:bg-white/5 focus-visible:ring-ring/40 focus-visible:ring-[3px]",
            pending && "opacity-60",
          )}
          aria-label="Switch organization"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-white/10 text-sidebar-foreground">
            <Building2 className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">
              {activeOrg?.name ?? "Select organization"}
            </span>
            {activeOrg ? (
              <span className="text-sidebar-muted-foreground block truncate text-xs capitalize">
                {activeOrg.role}
              </span>
            ) : null}
          </span>
          <ChevronsUpDown className="text-sidebar-muted-foreground size-4 shrink-0" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-[15rem]">
          <DropdownMenuLabel>Organizations</DropdownMenuLabel>
          {orgs.map((org) => (
            <DropdownMenuItem
              key={org.id}
              onClick={() => handleSwitch(org.id)}
              className="text-foreground"
            >
              <Building2 />
              <span className="flex-1 truncate">{org.name}</span>
              {org.id === activeOrg?.id ? <Check className="text-primary" /> : null}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setCreateOpen(true)}>
            <Plus />
            New organization
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateOrgDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}

function CreateOrgDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, action, pending] = useActionState(createOrganization, undefined);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New organization</DialogTitle>
          <DialogDescription>
            Create another workspace. You&apos;ll be its owner and switch to it right away.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4" noValidate>
          {state?.message ? <FormMessage>{state.message}</FormMessage> : null}
          <OrgFields state={state} autoFocus />
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Creating…" : "Create organization"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
