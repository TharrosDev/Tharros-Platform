"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, MoreHorizontal, RotateCw, Trash2 } from "lucide-react";

import { removeEmployee, sendPortalLink } from "@/lib/employees/actions";
import type { Employee } from "@/lib/employees/queries";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

type ActionResult = { error?: string };

export function EmployeeRoster({
  employees,
  canManage,
}: {
  employees: Employee[];
  canManage: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = React.useTransition();
  const [confirm, setConfirm] = React.useState<Employee | null>(null);

  function run(action: () => Promise<ActionResult>, successMsg: string) {
    startTransition(async () => {
      const res = await action();
      if (res?.error) {
        toast.add({ title: "Something went wrong", description: res.error });
      } else {
        toast.add({ title: "Done", description: successMsg });
        router.refresh();
      }
    });
  }

  if (employees.length === 0) {
    return (
      <p className="text-muted-foreground type-body">
        No employees yet. Add your team above, then send each one a portal link.
      </p>
    );
  }

  return (
    <section className="space-y-3">
      <h2 className="type-h2">Roster</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            <TableHead>Portal</TableHead>
            {canManage ? <TableHead className="w-10 text-right">Actions</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {employees.map((e) => (
            <TableRow key={e.id}>
              <TableCell>
                <Link
                  href={`/scheduling/employees/${e.id}`}
                  className="flex flex-col hover:underline"
                >
                  <span className="text-foreground font-medium">{e.name}</span>
                  <span className="text-muted-foreground text-xs">{e.email}</span>
                </Link>
              </TableCell>
              <TableCell>
                {e.hasPortalAccess ? (
                  <Badge variant="info">{e.lastUsedAt ? "Active" : "Link sent"}</Badge>
                ) : (
                  <Badge variant="outline">No link</Badge>
                )}
              </TableCell>
              {canManage ? (
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
                      aria-label={`Actions for ${e.name}`}
                    >
                      <MoreHorizontal className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem
                        onClick={() =>
                          run(
                            () => sendPortalLink(e.id),
                            e.hasPortalAccess ? "Portal link resent." : "Portal link sent.",
                          )
                        }
                      >
                        {e.hasPortalAccess ? <RotateCw /> : <Mail />}
                        {e.hasPortalAccess ? "Resend portal link" : "Send portal link"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setConfirm(e)}
                      >
                        <Trash2 />
                        Remove employee
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remove employee</DialogTitle>
            <DialogDescription>
              Remove {confirm?.name} from the roster? Their portal link will stop working
              immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)} disabled={pending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => {
                const target = confirm;
                setConfirm(null);
                if (target) run(() => removeEmployee(target.id), "Employee removed.");
              }}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
