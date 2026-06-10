"use client";

import * as React from "react";
import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { CalendarClock, CalendarOff, Check, CircleCheck, Pencil, Wand2 } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FadeIn } from "@/components/motion";
import { useToast } from "@/components/ui/toast";
import { DAYS } from "@/components/scheduling/setup/model";
import type { ParsedAvailability } from "@/lib/scheduling/availability-parse";
import {
  savePortalAvailability,
  submitAvailabilityText,
  type PortalAvailabilityState,
  type SaveAvailabilityResult,
} from "@/lib/portal/availability-actions";

const INITIAL: PortalAvailabilityState = { status: "idle" };

/**
 * Day 45 — the employee's plain-language availability flow. They describe when
 * they can work; a DeepSeek parse turns it into the structured whitelist, shown
 * back for confirmation. Confirm saves it; "Make a change" re-parses with the
 * prior result as context so corrections accumulate.
 */
export function AvailabilityEntry({ employeeName }: { employeeName: string }) {
  const toast = useToast();
  const [state, action, parsing] = useActionState(submitAvailabilityText, INITIAL);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState<SaveAvailabilityResult | null>(null);
  const [saving, startSave] = useTransition();

  // A fresh preview supersedes any prior "editing" / "saved" UI.
  const lastParsed = React.useRef<ParsedAvailability | null>(null);
  React.useEffect(() => {
    if (state.status === "preview" && state.parsed && state.parsed !== lastParsed.current) {
      lastParsed.current = state.parsed;
      setEditing(false);
      setSaved(null);
    }
  }, [state]);

  const preview = state.status === "preview" ? (state.parsed ?? null) : null;
  const showForm = !preview || editing;

  function confirm() {
    if (!preview) return;
    startSave(async () => {
      const res = await savePortalAvailability(preview);
      setSaved(res);
      toast.add({
        title: res.ok ? "Availability saved" : "Couldn't save",
        description: res.message,
      });
    });
  }

  if (saved?.ok) {
    return (
      <section className="bg-card flex flex-col items-center gap-3 rounded-lg border px-6 py-12 text-center shadow-xs">
        <span className="bg-success/12 text-success flex size-11 items-center justify-center rounded-full">
          <CircleCheck className="size-6" aria-hidden />
        </span>
        <h2 className="type-h2">You&apos;re all set</h2>
        <p className="text-muted-foreground max-w-xs type-body">{saved.message}</p>
        <Link href="/portal" className={buttonVariants({ variant: "outline", className: "mt-2" })}>
          Back to my portal
        </Link>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {preview ? (
        <FadeIn>
          <AvailabilityPreview parsed={preview} dimmed={editing} />
        </FadeIn>
      ) : null}

      {showForm ? (
        <form action={action} className="flex flex-col gap-3">
          {preview ? <input type="hidden" name="prior" value={JSON.stringify(preview)} /> : null}

          <label htmlFor="availability-text" className="type-body font-medium">
            {preview ? "What should change?" : `When can you work, ${employeeName.split(" ")[0]}?`}
          </label>
          <p className="text-muted-foreground -mt-1.5 type-small">
            {preview
              ? "Tell me the fix in plain words and I'll update the summary above."
              : "Just describe it however you'd say it out loud."}
          </p>

          <Textarea
            id="availability-text"
            name="text"
            rows={4}
            required
            defaultValue={preview ? "" : (state.sourceText ?? "")}
            placeholder={
              preview
                ? "e.g. actually I can't do Saturdays"
                : "e.g. I can do Mon–Fri 9 to 5, not Tuesdays after 5, and I'm off June 20–25"
            }
            aria-describedby={state.status === "error" ? "availability-error" : undefined}
          />

          {state.status === "error" && state.message ? (
            <p id="availability-error" className="text-destructive type-small">
              {state.message}
            </p>
          ) : null}

          <div className="flex items-center gap-2">
            <Button type="submit" disabled={parsing}>
              <Wand2 className="size-4" aria-hidden />
              {parsing ? "Reading…" : preview ? "Update" : "Check my availability"}
            </Button>
            {preview && editing ? (
              <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={confirm} disabled={saving}>
            <Check className="size-4" aria-hidden />
            {saving ? "Saving…" : "Looks right, save it"}
          </Button>
          <Button variant="outline" onClick={() => setEditing(true)} disabled={saving}>
            <Pencil className="size-4" aria-hidden />
            Make a change
          </Button>
        </div>
      )}
    </div>
  );
}

/* --------------------------------- Preview --------------------------------- */

function AvailabilityPreview({ parsed, dimmed }: { parsed: ParsedAvailability; dimmed: boolean }) {
  const byDay = new Map(
    parsed.permanent.filter((d) => d.is_available).map((d) => [d.day_of_week, d]),
  );

  return (
    <section
      className={`bg-card rounded-lg border p-5 shadow-xs transition-opacity motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 ${
        dimmed ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <CalendarClock className="text-primary size-5" aria-hidden />
        <h2 className="type-h2">Here&apos;s what I understood</h2>
      </div>
      {parsed.summary ? (
        <p className="text-foreground/90 mt-2 type-body">{parsed.summary}</p>
      ) : null}

      <h3 className="text-muted-foreground mt-5 mb-2 type-meta">Weekly</h3>
      <ul className="divide-border divide-y">
        {DAYS.map((d) => {
          const row = byDay.get(d.value);
          return (
            <li key={d.value} className="flex items-center justify-between py-2">
              <span className="type-body font-medium">{d.label}</span>
              {row ? (
                <span className="text-foreground type-small num">
                  {windowLabel(row.start_time, row.end_time)}
                </span>
              ) : (
                <span className="text-muted-foreground/70 type-small">Not available</span>
              )}
            </li>
          );
        })}
      </ul>

      {parsed.temporary.length > 0 ? (
        <>
          <h3 className="text-muted-foreground mt-5 mb-2 type-meta">Date exceptions</h3>
          <ul className="flex flex-col gap-2">
            {parsed.temporary.map((t, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2">
                <Badge variant={t.is_available ? "success" : "secondary"}>
                  {t.is_available ? (
                    "Available"
                  ) : (
                    <>
                      <CalendarOff className="size-3" aria-hidden /> Off
                    </>
                  )}
                </Badge>
                <span className="type-small num">
                  {dateRangeLabel(t.effective_date, t.end_date)}
                </span>
                {t.start_time && t.end_time ? (
                  <span className="text-muted-foreground type-small num">
                    {windowLabel(t.start_time, t.end_time)}
                  </span>
                ) : null}
                {t.notes ? (
                  <span className="text-muted-foreground type-small">· {t.notes}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}

/* -------------------------------- Formatting ------------------------------- */

function to12h(t: string): string {
  const [hRaw, m] = t.slice(0, 5).split(":");
  const h = Number(hRaw);
  const period = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${period}`;
}

function windowLabel(start?: string | null, end?: string | null): string {
  if (!start || !end) return "All day";
  return `${to12h(start)} – ${to12h(end)}`;
}

function dateRangeLabel(start: string, end?: string | null): string {
  if (!end || end === start) return start;
  return `${start} → ${end}`;
}
