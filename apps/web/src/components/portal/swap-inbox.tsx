"use client";

import { useState, useTransition } from "react";
import { ArrowLeftRight, Inbox } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { PortalSwap } from "@/lib/portal/schedule";
import { respondToSwap } from "@/lib/portal/swap-actions";

/**
 * Day 56 — the portal swap surfaces: incoming targeted proposals (accept/decline) and
 * open offers this employee can pick up. Both call `respondToSwap`; the agent then
 * validates + auto-approves or escalates to a manager.
 */

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

function useSwapAction() {
  const toast = useToast();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  function run(requestId: string, accept: boolean) {
    setPendingId(requestId);
    startTransition(async () => {
      const res = await respondToSwap(requestId, accept);
      setPendingId(null);
      toast.add(
        res.ok
          ? { title: "Swap", description: res.message }
          : { title: "Couldn't do that", description: res.message },
      );
    });
  }
  return { pendingId, run };
}

export function SwapInbox({ incoming, open }: { incoming: PortalSwap[]; open: PortalSwap[] }) {
  const { pendingId, run } = useSwapAction();
  if (incoming.length === 0 && open.length === 0) return null;

  return (
    <div className="space-y-6">
      {incoming.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-foreground flex items-center gap-2 type-meta font-medium">
            <Inbox className="size-4" /> Swap requests for you
          </h2>
          <ul className="space-y-2">
            {incoming.map((s) => {
              const busy = pendingId === s.requestId;
              return (
                <li
                  key={s.requestId}
                  className="border-primary/30 bg-primary/5 flex flex-col gap-3 rounded-xl border p-4"
                >
                  <div className="min-w-0">
                    <p className="text-foreground text-sm">
                      <strong>{s.fromName}</strong> wants you to take:
                    </p>
                    <p className="text-foreground font-medium tabular-nums">
                      {label(s.shift.startsAt, s.shift.endsAt)}
                    </p>
                    {s.shift.roleName ? (
                      <p className="text-muted-foreground text-sm">{s.shift.roleName}</p>
                    ) : null}
                    {s.tradeFor ? (
                      <p className="text-muted-foreground mt-1 text-xs">
                        In exchange for your {label(s.tradeFor.startsAt, s.tradeFor.endsAt)} shift.
                      </p>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => run(s.requestId, true)}
                      disabled={busy}
                      className="flex-1"
                    >
                      {busy ? "Working…" : "Accept"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => run(s.requestId, false)}
                      disabled={busy}
                    >
                      Decline
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {open.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-foreground flex items-center gap-2 type-meta font-medium">
            <ArrowLeftRight className="size-4" /> Shifts up for grabs
          </h2>
          <ul className="space-y-2">
            {open.map((s) => {
              const busy = pendingId === s.requestId;
              return (
                <li
                  key={s.requestId}
                  className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4"
                >
                  <div className="min-w-0">
                    <p className="text-foreground font-medium tabular-nums">
                      {label(s.shift.startsAt, s.shift.endsAt)}
                    </p>
                    {s.shift.roleName ? (
                      <p className="text-muted-foreground text-sm">{s.shift.roleName}</p>
                    ) : null}
                    <p className="text-muted-foreground mt-1 text-xs">
                      Offered by {s.fromName}. First to take it gets it.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => run(s.requestId, true)}
                    disabled={busy}
                  >
                    {busy ? "Working…" : "Take this shift"}
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
