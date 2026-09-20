import { CalendarPlus, Download } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { googleCalendarUrl } from "@/lib/scheduling/ics";
import type { PortalShift, ProposableCoworker } from "@/lib/portal/schedule";
import type { SickCallReasonPolicy } from "@/lib/scheduling/sick-call";
import { SickCallButton } from "@/components/portal/sick-call-button";
import { SwapProposalButton } from "@/components/portal/swap-proposal-button";

/**
 * Day 53 — the employee's hosted schedule list. Server component (no
 * interactivity): shifts grouped by day, each with a Google Calendar link, plus
 * a "Download .ics" button hitting /portal/schedule/ics. Times render in the
 * business wall clock (UTC accessors on the local-as-UTC ISO strings).
 */

const fmtDayHeading = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const fmtTime = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
});

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}
function timeRange(startsAt: string, endsAt: string): string {
  return `${fmtTime.format(new Date(Date.parse(startsAt)))} – ${fmtTime.format(new Date(Date.parse(endsAt)))}`;
}

export function PortalSchedule({
  shifts,
  orgName,
  reasonPolicy,
  coworkers,
}: {
  shifts: PortalShift[];
  orgName: string;
  reasonPolicy: SickCallReasonPolicy;
  coworkers: ProposableCoworker[];
}) {
  if (shifts.length === 0) {
    return (
      <div className="border-border bg-card border border-dashed p-8 text-center">
        <p className="text-foreground font-medium">No upcoming shifts</p>
        <p className="text-muted-foreground mt-1 text-sm">
          You have nothing scheduled in the next two weeks. Check back after the next schedule is
          published.
        </p>
      </div>
    );
  }

  // Group consecutive shifts by calendar day (already ordered by start).
  const days: { key: string; shifts: PortalShift[] }[] = [];
  for (const s of shifts) {
    const key = dayKey(s.startsAt);
    const last = days[days.length - 1];
    if (last && last.key === key) last.shifts.push(s);
    else days.push({ key, shifts: [s] });
  }

  return (
    <div className="space-y-6">
      <a
        href="/portal/schedule/ics"
        className={buttonVariants({ variant: "outline", size: "sm" })}
        download
      >
        <Download className="size-4" /> Download .ics
      </a>

      {days.map((day) => (
        <section key={day.key} className="space-y-2">
          <h2 className="text-muted-foreground type-meta">
            {fmtDayHeading.format(new Date(Date.parse(`${day.key}T00:00:00Z`)))}
          </h2>
          <ul className="space-y-2">
            {day.shifts.map((s) => (
              <li key={s.id} className="border-border bg-card flex items-start gap-3 border p-4">
                <div className="min-w-0 flex-1">
                  <p className="text-foreground font-medium tabular-nums">
                    {timeRange(s.startsAt, s.endsAt)}
                  </p>
                  {s.roleName ? (
                    <p className="text-muted-foreground text-sm">{s.roleName}</p>
                  ) : null}
                  {s.breakMinutes > 0 ? (
                    <p className="text-muted-foreground text-xs">{s.breakMinutes} min break</p>
                  ) : null}
                  {s.notes ? <p className="text-muted-foreground mt-1 text-xs">{s.notes}</p> : null}
                  <div className="mt-2 flex items-center gap-4">
                    <SickCallButton
                      shiftId={s.id}
                      shiftLabel={`${fmtDayHeading.format(new Date(Date.parse(`${dayKey(s.startsAt)}T00:00:00Z`)))}, ${timeRange(s.startsAt, s.endsAt)}`}
                      reasonPolicy={reasonPolicy}
                    />
                    <SwapProposalButton
                      shiftId={s.id}
                      shiftLabel={`${fmtDayHeading.format(new Date(Date.parse(`${dayKey(s.startsAt)}T00:00:00Z`)))}, ${timeRange(s.startsAt, s.endsAt)}`}
                      coworkers={coworkers}
                    />
                  </div>
                </div>
                <a
                  href={googleCalendarUrl({
                    uid: s.id,
                    title: s.roleName ? `${s.roleName} shift` : `${orgName} shift`,
                    startsAt: s.startsAt,
                    endsAt: s.endsAt,
                    location: orgName,
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground mt-0.5 shrink-0"
                  aria-label="Add to Google Calendar"
                  title="Add to Google Calendar"
                >
                  <CalendarPlus className="size-5" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
