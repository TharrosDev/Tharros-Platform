/**
 * Day 53 — pure iCalendar (.ics) + Google Calendar helpers for schedule delivery.
 *
 * Shift times are the project-wide local-wall-clock-as-UTC ISO strings. We emit
 * **floating** local times (`YYYYMMDDTHHMMSS`, no `Z`, no TZID) so a calendar app
 * shows the same wall clock the schedule was built in, regardless of the viewer's
 * timezone — the right behaviour for a single-location small business. Pure (no
 * I/O, no `server-only`) so it's unit-testable and importable anywhere.
 */

export type IcsEvent = {
  uid: string;
  title: string;
  startsAt: string;
  endsAt: string;
  location?: string;
  description?: string;
};

/** ISO `2026-06-15T09:00:00Z` → floating `20260615T090000`. */
export function icsStamp(iso: string): string {
  return iso.slice(0, 19).replace(/[-:]/g, "");
}

/** Escape a value for an iCalendar text field (RFC 5545 §3.3.11). */
function escapeText(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** A stable, deterministic DTSTAMP (no Date.now → pure). Uses the first event or epoch. */
function dtstamp(events: IcsEvent[]): string {
  const earliest = events.reduce<string | null>(
    (min, e) => (min === null || e.startsAt < min ? e.startsAt : min),
    null,
  );
  return icsStamp(earliest ?? "1970-01-01T00:00:00Z");
}

/** Build a VCALENDAR string with one VEVENT per shift. */
export function buildICS(events: IcsEvent[], calendarName = "My schedule"): string {
  const stamp = dtstamp(events);
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Tharros//Scheduling//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escapeText(calendarName)}`,
  ];
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsStamp(e.startsAt)}`,
      `DTEND:${icsStamp(e.endsAt)}`,
      `SUMMARY:${escapeText(e.title)}`,
    );
    if (e.location) lines.push(`LOCATION:${escapeText(e.location)}`);
    if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  // RFC 5545 wants CRLF line endings.
  return lines.join("\r\n") + "\r\n";
}

/** A Google Calendar "add event" URL prefilled from a single shift (floating local). */
export function googleCalendarUrl(event: IcsEvent): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${icsStamp(event.startsAt)}/${icsStamp(event.endsAt)}`,
  });
  if (event.description) params.set("details", event.description);
  if (event.location) params.set("location", event.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
