"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, m } from "motion/react";
import { ArrowLeftRight, CalendarOff, CheckCircle2, UserX } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import {
  approveSwap,
  approveTimeOff,
  denySwap,
  denyTimeOff,
  findReplacement,
} from "@/lib/scheduling/calendar-actions";
import type { EscalatedReplacement, EscalatedSwap } from "@/lib/scheduling/queries";
import type { PendingTimeOff } from "@/lib/scheduling/time-off";

const IMPACT_BADGE: Record<
  string,
  { label: string; variant: "success" | "warning" | "destructive" }
> = {
  low: { label: "Low impact", variant: "success" },
  medium: { label: "Medium impact", variant: "warning" },
  high: { label: "High impact", variant: "destructive" },
};

function formatRange(start: string, end: string): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const s = fmt.format(new Date(Date.parse(`${start}T00:00:00Z`)));
  const e = fmt.format(new Date(Date.parse(`${end}T00:00:00Z`)));
  return s === e ? s : `${s} – ${e}`;
}

/**
 * The approvals inbox body. A decided card animates out of its section on
 * success; a server error leaves it in place with a toast. Actions are the
 * same server actions the calendar's inline panels use, so there is exactly
 * one decision path.
 */
export function ApprovalsInbox({
  swaps: initialSwaps,
  timeOff: initialTimeOff,
  replacements: initialReplacements,
}: {
  swaps: EscalatedSwap[];
  timeOff: PendingTimeOff[];
  replacements: EscalatedReplacement[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = React.useTransition();
  const [swaps, setSwaps] = React.useState(initialSwaps);
  const [timeOff, setTimeOff] = React.useState(initialTimeOff);
  const [replacements, setReplacements] = React.useState(initialReplacements);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const total = swaps.length + timeOff.length + replacements.length;

  function resolve(
    id: string,
    remove: () => void,
    run: () => Promise<{ ok: true } | { ok: false; message: string }>,
    successTitle: string,
  ) {
    setBusyId(id);
    startTransition(async () => {
      const res = await run();
      setBusyId(null);
      if (res.ok) {
        remove();
        toast.add({ title: successTitle });
        router.refresh();
      } else {
        toast.add({ title: "That didn't go through", description: res.message });
      }
    });
  }

  if (total === 0) {
    return (
      <Card className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <span className="bg-success/15 text-success flex size-12 items-center justify-center">
          <CheckCircle2 className="size-6" />
        </span>
        <p className="text-foreground font-medium">Nothing needs your call</p>
        <p className="text-muted-foreground max-w-sm text-sm">
          Swap requests, time off, and unfilled shifts that the agent can&apos;t resolve on its own
          will land here.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {replacements.length > 0 ? (
        <ApprovalSection
          icon={<UserX className="size-4" />}
          title="Unfilled shifts"
          description="Sick calls where nobody picked up the open shift."
        >
          <AnimatePresence initial={false}>
            {replacements.map((r) => (
              <ApprovalCard key={r.sickCallId}>
                <div className="min-w-0 flex-1">
                  <p className="type-body font-medium">
                    {r.employeeName} called out of {r.shiftLabel}
                  </p>
                  <p className="text-muted-foreground type-small mt-0.5">
                    Offers expired with no taker. Re-broadcast to everyone eligible, or assign
                    someone on the schedule.
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    size="sm"
                    disabled={pending && busyId === r.sickCallId}
                    onClick={() =>
                      resolve(
                        r.sickCallId,
                        () =>
                          setReplacements((prev) =>
                            prev.filter((x) => x.sickCallId !== r.sickCallId),
                          ),
                        () => findReplacement({ shiftId: r.shiftId }),
                        "Replacement offers sent",
                      )
                    }
                  >
                    Find replacement
                  </Button>
                </div>
              </ApprovalCard>
            ))}
          </AnimatePresence>
        </ApprovalSection>
      ) : null}

      {swaps.length > 0 ? (
        <ApprovalSection
          icon={<ArrowLeftRight className="size-4" />}
          title="Shift swaps"
          description="Trades both employees agreed to that need your sign-off."
        >
          <AnimatePresence initial={false}>
            {swaps.map((s) => (
              <ApprovalCard key={s.requestId}>
                <div className="min-w-0 flex-1">
                  <p className="type-body font-medium">
                    {s.requesterName} ↔ {s.claimantName}
                  </p>
                  <p className="text-muted-foreground type-small mt-0.5">
                    {s.requesterName} gives up {s.shiftLabel}
                    {s.tradeForLabel ? ` in exchange for ${s.tradeForLabel}` : ""}.
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending && busyId === s.requestId}
                    onClick={() =>
                      resolve(
                        s.requestId,
                        () => setSwaps((prev) => prev.filter((x) => x.requestId !== s.requestId)),
                        () => denySwap({ requestId: s.requestId }),
                        "Swap declined",
                      )
                    }
                  >
                    Deny
                  </Button>
                  <Button
                    size="sm"
                    disabled={pending && busyId === s.requestId}
                    onClick={() =>
                      resolve(
                        s.requestId,
                        () => setSwaps((prev) => prev.filter((x) => x.requestId !== s.requestId)),
                        () => approveSwap({ requestId: s.requestId }),
                        "Swap approved",
                      )
                    }
                  >
                    Approve
                  </Button>
                </div>
              </ApprovalCard>
            ))}
          </AnimatePresence>
        </ApprovalSection>
      ) : null}

      {timeOff.length > 0 ? (
        <ApprovalSection
          icon={<CalendarOff className="size-4" />}
          title="Time off"
          description="Requests the agent flagged for a human decision."
        >
          <AnimatePresence initial={false}>
            {timeOff.map((t) => {
              const impact = t.impactBand ? IMPACT_BADGE[t.impactBand] : null;
              return (
                <ApprovalCard key={t.id}>
                  <div className="min-w-0 flex-1">
                    <p className="type-body flex flex-wrap items-center gap-2 font-medium">
                      {t.employeeName}: {formatRange(t.startDate, t.endDate)}
                      {impact ? <Badge variant={impact.variant}>{impact.label}</Badge> : null}
                    </p>
                    {t.reason ? (
                      <p className="text-muted-foreground type-small mt-0.5">“{t.reason}”</p>
                    ) : null}
                    {t.recommendation ? (
                      <p className="text-muted-foreground type-small mt-1">{t.recommendation}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending && busyId === t.id}
                      onClick={() =>
                        resolve(
                          t.id,
                          () => setTimeOff((prev) => prev.filter((x) => x.id !== t.id)),
                          () => denyTimeOff({ requestId: t.id }),
                          "Time off declined",
                        )
                      }
                    >
                      Deny
                    </Button>
                    <Button
                      size="sm"
                      disabled={pending && busyId === t.id}
                      onClick={() =>
                        resolve(
                          t.id,
                          () => setTimeOff((prev) => prev.filter((x) => x.id !== t.id)),
                          () => approveTimeOff({ requestId: t.id }),
                          "Time off approved",
                        )
                      }
                    >
                      Approve
                    </Button>
                  </div>
                </ApprovalCard>
              );
            })}
          </AnimatePresence>
        </ApprovalSection>
      ) : null}
    </div>
  );
}

function ApprovalSection({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="type-h2 flex items-center gap-2">
          <span className="bg-primary-soft text-primary-soft-foreground flex size-7 items-center justify-center">
            {icon}
          </span>
          {title}
        </h2>
        <p className="text-muted-foreground type-small mt-1">{description}</p>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function ApprovalCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <m.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className={cn(
        "bg-card shadow-card flex flex-col gap-3 border p-4 sm:flex-row sm:items-center",
        className,
      )}
    >
      {children}
    </m.div>
  );
}
