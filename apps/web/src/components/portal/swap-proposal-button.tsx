"use client";

import { useState, useTransition } from "react";
import { ArrowLeftRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProposableCoworker } from "@/lib/portal/schedule";
import { proposeSwap } from "@/lib/portal/swap-actions";

/**
 * Day 56 — the "Swap" affordance on a portal schedule row. Pick a coworker to trade
 * with (and optionally one of their shifts → a true trade; none → hand it to them),
 * or post it as an open offer anyone eligible can pick up. The agent validates +
 * auto-approves or escalates after the coworker accepts.
 */

const OPEN = "__open__";
const HANDOFF = "__handoff__";

const fmtDay = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const fmtTime = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
});
function label(startsAt: string, endsAt: string): string {
  const s = new Date(Date.parse(startsAt));
  const e = new Date(Date.parse(endsAt));
  return `${fmtDay.format(s)}, ${fmtTime.format(s)} – ${fmtTime.format(e)}`;
}

export function SwapProposalButton({
  shiftId,
  shiftLabel,
  coworkers,
}: {
  shiftId: string;
  shiftLabel: string;
  coworkers: ProposableCoworker[];
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [coworker, setCoworker] = useState<string>(OPEN);
  const [theirShift, setTheirShift] = useState<string>(HANDOFF);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = coworkers.find((c) => c.id === coworker);

  function reset() {
    setCoworker(OPEN);
    setTheirShift(HANDOFF);
    setError(null);
  }

  function submit() {
    setError(null);
    const targetEmployeeId = coworker === OPEN ? null : coworker;
    const targetShiftId = coworker === OPEN || theirShift === HANDOFF ? null : theirShift;
    startTransition(async () => {
      const res = await proposeSwap({ shiftId, targetEmployeeId, targetShiftId });
      if (res.ok) {
        setOpen(false);
        reset();
        toast.add({ title: "Swap requested", description: res.message });
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
        className="text-muted-foreground hover:text-primary-soft-foreground mt-0.5 inline-flex shrink-0 items-center gap-1 text-xs"
        aria-label="Propose a swap for this shift"
      >
        <ArrowLeftRight className="size-4" /> Swap
      </button>

      <Dialog
        open={open}
        onOpenChange={(o) => !pending && (o ? setOpen(true) : (setOpen(false), reset()))}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Swap this shift?</DialogTitle>
            <DialogDescription>{shiftLabel}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="type-small font-medium">Swap with</label>
              <Select
                value={coworker}
                onValueChange={(v) => {
                  setCoworker(v ?? OPEN);
                  setTheirShift(HANDOFF);
                }}
                disabled={pending}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={OPEN}>Anyone (open offer)</SelectItem>
                  {coworkers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selected ? (
              <div className="flex flex-col gap-2">
                <label className="type-small font-medium">Trade for</label>
                <Select
                  value={theirShift}
                  onValueChange={(v) => setTheirShift(v ?? HANDOFF)}
                  disabled={pending}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={HANDOFF}>Just give them my shift</SelectItem>
                    {selected.shifts.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {label(s.startsAt, s.endsAt)}
                        {s.roleName ? ` · ${s.roleName}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {error ? <p className="text-destructive type-small">{error}</p> : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setOpen(false);
                reset();
              }}
              disabled={pending}
            >
              Never mind
            </Button>
            <Button type="button" onClick={submit} disabled={pending}>
              {pending ? "Sending…" : "Propose swap"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
