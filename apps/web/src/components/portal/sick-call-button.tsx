"use client";

import { useState, useTransition } from "react";
import { CalendarX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SickCallReasonPolicy } from "@/lib/scheduling/sick-call";
import { reportSickCall } from "@/lib/portal/sick-call-actions";

/**
 * Day 54 — the employee's "I can't make this shift" affordance on a portal
 * schedule row. Opens a small dialog; the reason field follows the org policy
 * (optional / required / hidden). Submitting calls the sick-call action — on
 * success the assistant's confirmation is toasted and the schedule revalidates
 * (the vacated shift drops off the list).
 */
export function SickCallButton({
  shiftId,
  shiftLabel,
  reasonPolicy,
}: {
  shiftId: string;
  shiftLabel: string;
  reasonPolicy: SickCallReasonPolicy;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    if (reasonPolicy === "required" && !reason.trim()) {
      setError("Please add a short reason so your manager has the context.");
      return;
    }
    startTransition(async () => {
      const res = await reportSickCall(
        shiftId,
        reasonPolicy === "hidden" ? undefined : reason.trim() || undefined,
      );
      if (res.ok) {
        setOpen(false);
        setReason("");
        toast.add({ title: "Manager notified", description: res.message });
      } else {
        setError(res.message);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-muted-foreground hover:text-destructive mt-0.5 inline-flex shrink-0 items-center gap-1 text-xs"
        aria-label="Report that you can't make this shift"
      >
        <CalendarX className="size-4" /> Can&apos;t make it
      </button>

      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Can&apos;t make this shift?</DialogTitle>
            <DialogDescription>{shiftLabel}</DialogDescription>
          </DialogHeader>

          {reasonPolicy !== "hidden" ? (
            <div className="flex flex-col gap-2">
              <label htmlFor="sick-call-reason" className="type-small font-medium">
                Reason{reasonPolicy === "optional" ? " (optional)" : ""}
              </label>
              <Textarea
                id="sick-call-reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. I'm unwell and can't come in"
                disabled={pending}
              />
            </div>
          ) : null}

          {error ? <p className="text-destructive type-small">{error}</p> : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Never mind
            </Button>
            <Button type="button" variant="destructive" onClick={submit} disabled={pending}>
              {pending ? "Sending…" : "Notify my manager"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
