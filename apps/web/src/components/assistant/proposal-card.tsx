"use client";

import * as React from "react";
import { Check, Loader2, X } from "lucide-react";

import { confirmProposal, dismissProposal } from "@/lib/assistant/proposal-actions";
import type { ProposalView } from "@/lib/assistant/types";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

const STATUS_TEXT: Record<Exclude<ProposalView["status"], "pending">, string> = {
  confirmed: "Done",
  dismissed: "Dismissed",
  failed: "Couldn't apply",
};

/** A change the assistant proposed. Nothing happens until the user confirms. */
export function ProposalCard({ proposal }: { proposal: ProposalView }) {
  const toast = useToast();
  const [status, setStatus] = React.useState(proposal.status);
  const [busy, setBusy] = React.useState(false);

  async function decide(confirm: boolean) {
    setBusy(true);
    const res = await (confirm ? confirmProposal : dismissProposal)(proposal.id);
    setBusy(false);
    setStatus(res.status);
    if (res.error) toast.add({ title: "Couldn't apply the change", description: res.error });
  }

  return (
    <div className="bg-card mt-3 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm">
      <p className="text-foreground min-w-0 flex-1">{proposal.summary}</p>
      {status === "pending" ? (
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => void decide(false)}>
            <X className="size-4" />
            Dismiss
          </Button>
          <Button size="sm" disabled={busy} onClick={() => void decide(true)}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Confirm
          </Button>
        </div>
      ) : (
        <span className="text-muted-foreground shrink-0 text-xs font-medium">
          {STATUS_TEXT[status]}
        </span>
      )}
    </div>
  );
}
