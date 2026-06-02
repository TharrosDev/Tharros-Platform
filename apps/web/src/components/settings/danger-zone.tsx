"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { deleteOrganization } from "@/lib/org/actions";
import { deleteAccount } from "@/lib/account/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";

/**
 * Danger zone (Day 21): cascading org deletion (owner-only) and full account
 * deletion (PIPEDA erasure). Both require typing an exact confirmation string
 * before the destructive button enables — no accidental clicks. The server
 * actions are the authoritative guard; this is just the UI gate.
 */
export function DangerZone({
  orgName,
  isOwner,
}: {
  orgName: string;
  isOwner: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = React.useTransition();

  const [orgConfirm, setOrgConfirm] = React.useState("");
  const [acctConfirm, setAcctConfirm] = React.useState("");

  function onDeleteOrg() {
    startTransition(async () => {
      const res = await deleteOrganization(orgConfirm);
      if (res?.error) {
        toast.add({ title: "Couldn't delete organization", description: res.error });
        return;
      }
      toast.add({ title: "Organization deleted", description: `${orgName} is gone.` });
      router.push("/dashboard");
      router.refresh();
    });
  }

  function onDeleteAccount() {
    startTransition(async () => {
      // On success this redirects server-side; only errors return here.
      const res = await deleteAccount(acctConfirm);
      if (res?.error) {
        toast.add({ title: "Couldn't delete account", description: res.error });
      }
    });
  }

  return (
    <div className="space-y-6">
      {isOwner ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle>Delete this organization</CardTitle>
            <CardDescription>
              Permanently deletes <strong>{orgName}</strong> and all its data:
              its team, settings, and subscription. Any active subscription is
              cancelled. This cannot be undone.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="org-confirm">
                Type <span className="font-mono">{orgName}</span> to confirm
              </Label>
              <Input
                id="org-confirm"
                value={orgConfirm}
                onChange={(e) => setOrgConfirm(e.target.value)}
                autoComplete="off"
                placeholder={orgName}
              />
            </div>
            <Button
              variant="destructive"
              disabled={pending || orgConfirm.trim() !== orgName}
              onClick={onDeleteOrg}
            >
              Delete organization
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle>Delete your account</CardTitle>
          <CardDescription>
            Permanently deletes your account and personal data. Organizations you
            solely own are deleted with it (and their subscriptions cancelled);
            those you share are left for the other owners. This cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="acct-confirm">
              Type <span className="font-mono">DELETE</span> to confirm
            </Label>
            <Input
              id="acct-confirm"
              value={acctConfirm}
              onChange={(e) => setAcctConfirm(e.target.value)}
              autoComplete="off"
              placeholder="DELETE"
            />
          </div>
          <Button
            variant="destructive"
            disabled={pending || acctConfirm.trim().toUpperCase() !== "DELETE"}
            onClick={onDeleteAccount}
          >
            Delete my account
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
