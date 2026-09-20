"use client";

import { Lock, Plus, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";

export type DayListShift = {
  id: string;
  /** "9:00–17:00" style label, already formatted by the caller. */
  timeLabel: string;
  /** Who / what: employee name, role, or "Open shift". */
  title: string;
  subtitle?: string | null;
  tone: "normal" | "open" | "violation";
  locked?: boolean;
};

/**
 * Agenda view of a scheduling window: one section per day, shift cards
 * inside. The mobile companion to the two-week grid (and the shape the
 * employee portal schedule shares). Pure presentation; the caller owns data
 * mapping and click behavior.
 */
export function DayList({
  days,
  dayLabel,
  shiftsFor,
  onShiftClick,
  onAddShift,
  emptyLabel = "No shifts",
  className,
}: {
  days: string[];
  dayLabel: (day: string) => string;
  shiftsFor: (day: string) => DayListShift[];
  onShiftClick?: (id: string) => void;
  onAddShift?: (day: string) => void;
  emptyLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4", className)}>
      {days.map((day) => {
        const shifts = shiftsFor(day);
        return (
          <section key={day} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="type-meta text-muted-foreground">{dayLabel(day)}</h3>
              {onAddShift ? (
                <button
                  type="button"
                  onClick={() => onAddShift(day)}
                  aria-label={`Add shift on ${dayLabel(day)}`}
                  className="text-muted-foreground hover:text-foreground rounded p-1 transition-colors "
                >
                  <Plus className="size-4" />
                </button>
              ) : null}
            </div>
            {shifts.length === 0 ? (
              <p className="text-muted-foreground/70 border border-dashed px-3 py-2.5 text-sm">
                {emptyLabel}
              </p>
            ) : (
              <ul className="space-y-1.5">
                {shifts.map((s) => {
                  const body = (
                    <>
                      <span className="flex items-center gap-1.5 text-sm font-medium tabular-nums">
                        {s.timeLabel}
                        {s.locked ? <Lock className="size-3" aria-label="Locked" /> : null}
                        {s.tone === "violation" ? (
                          <TriangleAlert className="size-3.5" aria-hidden />
                        ) : null}
                      </span>
                      <span className="block truncate text-sm">{s.title}</span>
                      {s.subtitle ? (
                        <span className="text-muted-foreground block truncate text-xs">
                          {s.subtitle}
                        </span>
                      ) : null}
                    </>
                  );
                  const toneClass =
                    s.tone === "violation"
                      ? "border-destructive/50 bg-destructive/10 text-destructive"
                      : s.tone === "open"
                        ? "border-warning/50 border-dashed bg-warning/10 text-warning"
                        : "border-border bg-card";
                  return (
                    <li key={s.id}>
                      {onShiftClick ? (
                        <button
                          type="button"
                          onClick={() => onShiftClick(s.id)}
                          className={cn(
                            " w-full border px-3 py-2.5 text-left transition-colors ",
                            toneClass,
                            "hover:bg-accent/60",
                          )}
                        >
                          {body}
                        </button>
                      ) : (
                        <div className={cn(" border px-3 py-2.5", toneClass)}>{body}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
