"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogOut, MoreHorizontal, RotateCw, ShieldCheck, ShieldMinus, Trash2 } from "lucide-react";

import { changeRole, leaveOrg, removeMember, resendInvite, revokeInvite } from "@/lib/team/actions";
import type { PendingInvite, TeamMember, TeamRole } from "@/lib/team/queries";
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
type Confirm = {
  title: string;
  description: string;
  confirmLabel: string;
  successMsg: string;
  run: () => Promise<ActionResult>;
};

function roleBadgeVariant(role: TeamRole): "solid" | "info" | "outline" {
  if (role === "owner") return "solid";
  if (role === "admin") return "info";
  return "outline";
}

export function TeamLists({
  members,
  pendingInvites,
  viewerRole,
  currentUserId,
}: {
  members: TeamMember[];
  pendingInvites: PendingInvite[];
  viewerRole: TeamRole | null;
  currentUserId: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = React.useTransition();
  const [confirm, setConfirm] = React.useState<Confirm | null>(null);

  const canManage = viewerRole === "owner" || viewerRole === "admin";
  const isOwner = viewerRole === "owner";
  // Owners can't leave (last-owner guard / ownership transfer is out of scope).
  const canLeave = viewerRole !== null && viewerRole !== "owner";

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

  function confirmThen() {
    if (!confirm) return;
    const c = confirm;
    setConfirm(null);
    run(c.run, c.successMsg);
  }

  return (
    <>
      <section className="space-y-3">
        <h2 className="type-h2">Members</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Role</TableHead>
              {canManage ? <TableHead className="w-10 text-right">Actions</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => {
              const isSelf = m.userId === currentUserId;
              // Owners are never actioned here (ownership transfer is out of scope);
              // you can't action yourself from this menu either.
              const canActOnRow =
                canManage && !isSelf && m.role !== "owner" && (isOwner || m.role === "member");

              return (
                <TableRow key={m.userId}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-foreground font-medium">
                        {m.name ?? m.email}
                        {isSelf ? <span className="text-muted-foreground"> (you)</span> : null}
                      </span>
                      {m.name ? (
                        <span className="text-muted-foreground text-xs">{m.email}</span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={roleBadgeVariant(m.role)} className="capitalize">
                      {m.role}
                    </Badge>
                  </TableCell>
                  {canManage ? (
                    <TableCell className="text-right">
                      {canActOnRow ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
                            aria-label="Member actions"
                          >
                            <MoreHorizontal className="size-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            {isOwner && m.role === "member" ? (
                              <DropdownMenuItem
                                onClick={() =>
                                  run(() => changeRole(m.userId, "admin"), "Promoted to admin.")
                                }
                              >
                                <ShieldCheck />
                                Make admin
                              </DropdownMenuItem>
                            ) : null}
                            {isOwner && m.role === "admin" ? (
                              <DropdownMenuItem
                                onClick={() =>
                                  run(() => changeRole(m.userId, "member"), "Changed to member.")
                                }
                              >
                                <ShieldMinus />
                                Make member
                              </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() =>
                                setConfirm({
                                  title: "Remove member",
                                  description: `Remove ${m.name ?? m.email} from this organization? They'll lose access immediately.`,
                                  confirmLabel: "Remove",
                                  successMsg: "Member removed.",
                                  run: () => removeMember(m.userId),
                                })
                              }
                            >
                              <Trash2 />
                              Remove from team
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {canLeave ? (
          <div className="flex justify-end pt-1">
            <Button
              variant="outline"
              size="sm"
              className="text-destructive"
              disabled={pending}
              onClick={() =>
                setConfirm({
                  title: "Leave organization",
                  description:
                    "Leave this organization? You'll lose access immediately and need a new invite to rejoin.",
                  confirmLabel: "Leave",
                  successMsg: "You left the organization.",
                  run: () => leaveOrg(),
                })
              }
            >
              <LogOut className="size-4" />
              Leave organization
            </Button>
          </div>
        ) : null}
      </section>

      {canManage && pendingInvites.length > 0 ? (
        <section className="space-y-3">
          <h2 className="type-h2">Pending invites</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="w-10 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingInvites.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="text-foreground">{inv.email}</TableCell>
                  <TableCell>
                    <Badge variant={roleBadgeVariant(inv.role)} className="capitalize">
                      {inv.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(inv.expiresAt).toLocaleDateString("en-CA", {
                      month: "short",
                      day: "numeric",
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
                        aria-label="Invite actions"
                      >
                        <MoreHorizontal className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem
                          onClick={() => run(() => resendInvite(inv.id), "Invite resent.")}
                        >
                          <RotateCw />
                          Resend invite
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() =>
                            setConfirm({
                              title: "Revoke invite",
                              description: `Revoke the invite for ${inv.email}? The link will stop working.`,
                              confirmLabel: "Revoke",
                              successMsg: "Invite revoked.",
                              run: () => revokeInvite(inv.id),
                            })
                          }
                        >
                          <Trash2 />
                          Revoke invite
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      ) : null}

      <Dialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{confirm?.title}</DialogTitle>
            <DialogDescription>{confirm?.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmThen} disabled={pending}>
              {confirm?.confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
