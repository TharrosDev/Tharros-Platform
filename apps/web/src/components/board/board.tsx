import * as React from "react";

import { cn } from "@/lib/utils";

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
          lead ? "border-primary/25" : "border-border",
        )}
      >
        <div className="flex min-w-0 items-baseline gap-3">
          <h2 id={headingId} className="type-h2 text-foreground">
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

      <div className="mt-4 flex flex-col gap-2">{children}</div>
    </section>
  );
}

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
        "rounded-xl relative flex items-stretch overflow-hidden",
        STOCK[tone],
        seatIndex === undefined ? undefined : "animate-strip-seat",
        className,
      )}
      {...props}
    >
      <span aria-hidden className={cn("absolute left-3 top-4 size-1.5 rounded-full", TAB[tone])} />
      {children}
    </div>
  );
}

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
        "min-h-control-lg flex flex-1 flex-wrap items-center gap-x-4 gap-y-1 pr-4 pl-7 py-3.5 sm:flex-nowrap",
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

function InitialsBox({ label, className }: { label: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "rounded-xl border-foreground/45 bg-card/60 type-meta text-muted-foreground group-hover:border-foreground group-hover:bg-primary group-hover:text-primary-foreground flex h-7 min-w-11 items-center justify-center border px-2 transition-colors",
        className,
      )}
    >
      {label}
    </span>
  );
}

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
      <ol className="border-border bg-card mt-4 overflow-hidden rounded-xl border">{children}</ol>
    </section>
  );
}

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
