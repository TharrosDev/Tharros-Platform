"use client";

import { useState, useTransition } from "react";
import { AnimatePresence, m } from "motion/react";
import { CalendarClock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { OpenOffer } from "@/lib/portal/schedule";
import { acceptReplacement, declineReplacement } from "@/lib/portal/replacement-actions";

/**
 * Day 55 — "Open shifts you can pick up" on the portal schedule. Each offer shows
 * Accept / Decline; accepting calls the atomic first-accept-wins action — if someone
 * else got there first the employee is toasted "already filled" and the list
 * revalidates away. The in-portal card is the source of truth (email is a nudge).
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

function offerLabel(startsAt: string, endsAt: string): string {
  const s = new Date(Date.parse(startsAt));
  const e = new Date(Date.parse(endsAt));
  return `${fmtDay.format(s)}, ${fmtTime.format(s)} – ${fmtTime.format(e)}`;
}

export function ReplacementOffers({ offers }: { offers: OpenOffer[] }) {
  const toast = useToast();
  const [pendingId, setPendingId] = useState<string | null>(null);
  // Locally resolved offers animate out immediately; revalidation confirms.
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
  const [, startTransition] = useTransition();

  const visible = offers.filter((o) => !gone.has(o.offerId));
  if (visible.length === 0) return null;

  function accept(offerId: string) {
    setPendingId(offerId);
    startTransition(async () => {
      const res = await acceptReplacement(offerId);
      setPendingId(null);
      toast.add(
        res.ok
          ? { title: "Shift claimed", description: res.message }
          : { title: "Couldn't claim it", description: res.message },
      );
      if (res.ok) setGone((prev) => new Set([...prev, offerId]));
    });
  }

  function decline(offerId: string) {
    setPendingId(offerId);
    startTransition(async () => {
      await declineReplacement(offerId);
      setPendingId(null);
      setGone((prev) => new Set([...prev, offerId]));
    });
  }

  return (
    <section className="space-y-2">
      <h2 className="text-foreground flex items-center gap-2 type-meta font-medium">
        <CalendarClock className="size-4" /> Open shifts you can pick up
      </h2>
      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {visible.map((o) => {
            const busy = pendingId === o.offerId;
            return (
              <m.li
                key={o.offerId}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="border-primary/30 bg-primary/5 flex flex-col gap-3 overflow-hidden rounded-xl border p-4"
              >
                <div className="min-w-0">
                  <p className="text-foreground font-medium tabular-nums">
                    {offerLabel(o.startsAt, o.endsAt)}
                  </p>
                  {o.roleName ? (
                    <p className="text-muted-foreground text-sm">{o.roleName}</p>
                  ) : null}
                  {o.breakMinutes > 0 ? (
                    <p className="text-muted-foreground text-xs">{o.breakMinutes} min break</p>
                  ) : null}
                  <p className="text-muted-foreground mt-1 text-xs">First to accept gets it.</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => accept(o.offerId)}
                    disabled={busy}
                    className="flex-1"
                  >
                    {busy ? "Working…" : "Accept shift"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => decline(o.offerId)}
                    disabled={busy}
                  >
                    Decline
                  </Button>
                </div>
              </m.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </section>
  );
}
