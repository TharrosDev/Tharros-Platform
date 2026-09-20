import * as React from "react";

import { cn } from "@/lib/utils";

/*
  The board vocabulary.

  A bay is a labelled section of the rack. A strip is one unit of work seated
  in it, carrying a ruled grid complete enough to read without opening it. The
  record log is what the system printed for itself.

  Nothing here is a card, so nothing here nests.
*/

type Tone = "plain" | "pending" | "signal" | "cleared" | "procedure";

const STOCK: Record<Tone, string> = {
  plain: "bg-card",
  pending: "bg-stock-pending",
  signal: "bg-stock-signal",
  cleared: "bg-stock-cleared",
  procedure: "bg-stock-procedure",
};

const TAB: Record<Tone, string> = {
  plain: "bg-input",
  pending: "bg-warning",
  signal: "bg-destructive",
  cleared: "bg-success",
  procedure: "bg-info",
};

/**
 * A labelled bay. `count` is printed beside the label; pass `lead` on the one
 * bay whose count is the page's headline number.
 */
function Bay({
  label,
  count,
  lead = false,
  headingId,
  action,
  children,
  className,
}: {
  label: string;
  count?: number | string;
  lead?: boolean;
  headingId: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={headingId}
      data-slot="bay"
      className={cn("flex min-w-0 flex-col", className)}
    >
      <header
        className={cn(
          "flex items-end justify-between gap-3 border-b pb-2",
          lead ? "border-foreground border-b-2" : "border-border",
        )}
      >
        <div className="flex min-w-0 items-baseline gap-3">
          <h2 id={headingId} className="type-meta text-foreground">
            {label}
          </h2>
          {count !== undefined && !lead ? (
            <span className="num text-muted-foreground type-small">{count}</span>
          ) : null}
        </div>
        {action}
      </header>

      {lead && count !== undefined ? (
        <p className="type-count text-foreground pt-3 pb-1 leading-none">{count}</p>
      ) : null}

      <div className="border-border flex flex-col border-x border-b">{children}</div>
    </section>
  );
}

/**
 * One strip in a bay. `tone` sets the stock it is printed on and the colour of
 * its tab; state is the paper and the tab, never a pill floated on top.
 *
 * `seatIndex` staggers the seating entrance for the lead bay. Leave it unset
 * everywhere else: the board settles once, not section by section.
 */
function Strip({
  tone = "plain",
  seatIndex,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & { tone?: Tone; seatIndex?: number }) {
  return (
    <div
      data-slot="strip"
      data-tone={tone}
      style={seatIndex === undefined ? undefined : { animationDelay: `${seatIndex * 45}ms` }}
      className={cn(
        "border-border relative flex items-stretch border-b last:border-b-0",
        STOCK[tone],
        seatIndex === undefined ? undefined : "animate-strip-seat",
        className,
      )}
      {...props}
    >
      <span aria-hidden className={cn("w-1 shrink-0", TAB[tone])} />
      {children}
    </div>
  );
}

/**
 * The strip's printed grid. Everything a reader needs is here, so the board is
 * legible without opening a single strip.
 */
function StripBody({
  what,
  detail,
  when,
  who,
  mark,
  className,
}: {
  what: React.ReactNode;
  detail?: React.ReactNode;
  when?: React.ReactNode;
  who?: React.ReactNode;
  mark?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-h-control-lg flex flex-1 flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5 sm:flex-nowrap",
        className,
      )}
    >
      <span className="min-w-0 flex-1 basis-full sm:basis-auto">
        <span className="type-strip block truncate font-semibold">{what}</span>
        {detail ? <span className="text-muted-foreground type-small block">{detail}</span> : null}
      </span>
      {when ? (
        <span className="num text-muted-foreground type-small shrink-0 tabular-nums">{when}</span>
      ) : null}
      {who ? (
        <span className="type-meta text-muted-foreground shrink-0 truncate">{who}</span>
      ) : null}
      {mark ? <span className="ml-auto shrink-0 sm:ml-0">{mark}</span> : null}
    </div>
  );
}

/**
 * The empty box only a person can fill. Every consequential thing the machine
 * produced arrives carrying one of these.
 */
function InitialsBox({ label, className }: { label: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "border-foreground/45 bg-card/60 type-meta text-muted-foreground group-hover:border-foreground group-hover:bg-primary group-hover:text-primary-foreground flex h-7 min-w-11 items-center justify-center border px-2 transition-colors",
        className,
      )}
    >
      {label}
    </span>
  );
}

/** The printed record. Continuous ruled lines, not a feed of cards. */
function RecordLog({
  headingId,
  label,
  action,
  children,
  className,
}: {
  headingId: string;
  label: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={headingId}
      data-slot="record-log"
      className={cn("min-w-0", className)}
    >
      <header className="border-border flex items-end justify-between gap-3 border-b pb-2">
        <h2 id={headingId} className="type-meta text-foreground">
          {label}
        </h2>
        {action}
      </header>
      <ol className="border-border bg-card border-x border-b">{children}</ol>
    </section>
  );
}

/** One line the system printed into the record. */
function LogLine({
  time,
  children,
  source,
  href,
}: {
  time: string;
  children: React.ReactNode;
  source?: string;
  href?: string;
}) {
  const body = (
    <>
      <span className="num text-info type-log shrink-0 tabular-nums">{time}</span>
      <span className="type-log min-w-0 flex-1 truncate">{children}</span>
      {source ? <span className="type-meta text-muted-foreground shrink-0">{source}</span> : null}
    </>
  );

  return (
    <li className="border-border border-b last:border-b-0">
      {href ? (
        <a
          href={href}
          className="hover:bg-accent flex min-h-9 items-center gap-3 px-3 py-1.5 transition-colors"
        >
          {body}
        </a>
      ) : (
        <div className="flex min-h-9 items-center gap-3 px-3 py-1.5">{body}</div>
      )}
    </li>
  );
}

export { Bay, Strip, StripBody, InitialsBox, RecordLog, LogLine };
export type { Tone };
