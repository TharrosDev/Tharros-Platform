"use client";

import Link from "next/link";
import { ArrowRight, Check, ChevronRight, CornerDownRight, Loader2 } from "lucide-react";

import type { DataBlock, LeadCardData, ShiftCardData } from "@/lib/assistant/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

/**
 * Pieces of an assistant turn beyond its prose: the tool-step trail, cards for
 * the records tools returned, and suggested follow-ups.
 */

/** Live while streaming (last step spins until text arrives); collapses once done. */
export function StepTrail({
  steps,
  streaming,
  working,
}: {
  steps: string[];
  streaming: boolean;
  /** A step is in flight (no text since the last status). */
  working: boolean;
}) {
  if (steps.length === 0) return null;
  const list = (
    <ol className="relative mt-2 space-y-1.5 pl-1">
      <span aria-hidden className="bg-border absolute top-2 bottom-2 left-[0.6875rem] w-px" />
      {steps.map((step, i) => {
        const active = streaming && working && i === steps.length - 1;
        return (
          <li key={i} className="text-muted-foreground relative flex items-center gap-2.5 text-sm">
            <span
              className={cn(
                "bg-card relative z-10 flex size-[1.125rem] shrink-0 items-center justify-center rounded-full border",
                active ? "border-primary-edge/40 text-primary" : "text-success",
              )}
            >
              {active ? (
                <Loader2 className="size-3 animate-spin motion-reduce:animate-none" />
              ) : (
                <Check className="size-3" strokeWidth={3} />
              )}
            </span>
            <span className={cn(active && "text-foreground")}>{step}</span>
          </li>
        );
      })}
    </ol>
  );

  if (streaming) {
    return (
      <div role="status" aria-live="polite" className="mb-3">
        {list}
      </div>
    );
  }
  return (
    <details className="group mb-3">
      <summary className="text-muted-foreground hover:text-foreground inline-flex cursor-pointer list-none items-center gap-1 rounded-md text-xs font-semibold transition-colors [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-3.5 transition-transform duration-150 group-open:rotate-90 motion-reduce:transition-none" />
        {steps.length === 1 ? "Used 1 step" : `Used ${steps.length} steps`}
      </summary>
      {list}
    </details>
  );
}

const leadVariant = (status: string) =>
  status === "won"
    ? "success"
    : status === "contacted"
      ? "info"
      : status === "qualified"
        ? "default"
        : status === "lost"
          ? "outline"
          : "secondary";

function LeadCards({ items }: { items: LeadCardData[] }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {items.map((l) => (
        <li key={l.id}>
          <Link
            href={`/leads/${l.id}`}
            className="bg-card hover:border-primary-edge/35 hover:bg-primary-soft/30 focus-visible:ring-ring/40 group flex items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors outline-none focus-visible:ring-[3px]"
          >
            <span className="min-w-0 flex-1">
              <span className="text-foreground block truncate text-sm font-semibold">{l.name}</span>
              <span className="text-muted-foreground block truncate text-xs">
                {l.company ?? l.email ?? "No company"}
              </span>
            </span>
            <Badge variant={leadVariant(l.status)} className="capitalize">
              {l.status}
            </Badge>
            <ArrowRight className="text-muted-foreground group-hover:text-primary size-4 shrink-0 transition-colors" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

const dayFmt = new Intl.DateTimeFormat("en-CA", {
  weekday: "short",
  month: "short",
  day: "numeric",
});
const timeFmt = new Intl.DateTimeFormat("en-CA", { hour: "numeric", minute: "2-digit" });

function ShiftRows({ items }: { items: ShiftCardData[] }) {
  return (
    <div className="bg-card overflow-hidden rounded-xl border">
      <table className="w-full text-sm">
        <caption className="sr-only">Shifts</caption>
        <thead className="bg-muted/60 text-muted-foreground text-left text-xs">
          <tr>
            <th scope="col" className="px-3.5 py-2 font-semibold">
              Day
            </th>
            <th scope="col" className="px-3.5 py-2 font-semibold">
              Time
            </th>
            <th scope="col" className="px-3.5 py-2 font-semibold">
              Who
            </th>
          </tr>
        </thead>
        <tbody className="divide-y tabular-nums">
          {items.map((s, i) => (
            <tr key={i}>
              <td className="px-3.5 py-2 whitespace-nowrap">
                {dayFmt.format(new Date(s.startsAt))}
              </td>
              <td className="px-3.5 py-2 whitespace-nowrap">
                {timeFmt.format(new Date(s.startsAt))}–{timeFmt.format(new Date(s.endsAt))}
              </td>
              <td className="px-3.5 py-2">
                {s.employee ?? <span className="text-warning font-semibold">Open shift</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Link
        href="/scheduling/calendar"
        className="text-primary-soft-foreground hover:bg-primary-soft/40 flex items-center gap-1.5 border-t px-3.5 py-2 text-xs font-semibold transition-colors"
      >
        Open the calendar
        <ArrowRight className="size-3.5" />
      </Link>
    </div>
  );
}

/** Records the tools returned this turn, newest block per kind only. */
export function DataBlocks({ data }: { data: DataBlock[] }) {
  const latest = new Map<DataBlock["kind"], DataBlock>();
  for (const block of data) latest.set(block.kind, block);
  if (latest.size === 0) return null;
  return (
    <div className="mt-4 space-y-3">
      {[...latest.values()].map((block) =>
        block.kind === "leads" ? (
          <LeadCards key="leads" items={block.items} />
        ) : (
          <ShiftRows key="shifts" items={block.items} />
        ),
      )}
    </div>
  );
}

export function Suggestions({ items, onPick }: { items: string[]; onPick: (q: string) => void }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-4 flex flex-col items-start gap-1.5">
      {items.map((q) => (
        <button
          key={q}
          type="button"
          onClick={() => onPick(q)}
          className="text-primary-soft-foreground hover:bg-primary-soft focus-visible:ring-ring/40 inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm font-medium transition-colors outline-none focus-visible:ring-[3px]"
        >
          <CornerDownRight className="size-3.5 shrink-0 opacity-70" />
          {q}
        </button>
      ))}
    </div>
  );
}
