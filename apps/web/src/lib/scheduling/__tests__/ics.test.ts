import { describe, expect, it } from "vitest";

import { buildICS, googleCalendarUrl, icsStamp, type IcsEvent } from "../ics";

const EVENT: IcsEvent = {
  uid: "shift-1@tharros",
  title: "Barista shift",
  startsAt: "2026-06-15T09:00:00Z",
  endsAt: "2026-06-15T17:00:00Z",
  location: "Bean Co",
  description: "Opening shift",
};

describe("icsStamp", () => {
  it("converts ISO to a floating local stamp (no Z)", () => {
    expect(icsStamp("2026-06-15T09:00:00Z")).toBe("20260615T090000");
  });
});

describe("buildICS", () => {
  const ics = buildICS([EVENT], "My schedule");

  it("wraps events in a VCALENDAR with CRLF lines", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
  });

  it("emits a VEVENT with floating DTSTART/DTEND and SUMMARY", () => {
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("UID:shift-1@tharros");
    expect(ics).toContain("DTSTART:20260615T090000");
    expect(ics).toContain("DTEND:20260615T170000");
    expect(ics).toContain("SUMMARY:Barista shift");
    expect(ics).toContain("LOCATION:Bean Co");
    expect(ics).toContain("DESCRIPTION:Opening shift");
  });

  it("escapes commas and semicolons in text fields", () => {
    const out = buildICS([{ ...EVENT, title: "Lead; opener, closer" }]);
    expect(out).toContain("SUMMARY:Lead\\; opener\\, closer");
  });

  it("is deterministic (no Date.now) — DTSTAMP from earliest event", () => {
    expect(buildICS([EVENT])).toBe(buildICS([EVENT]));
    expect(buildICS([EVENT])).toContain("DTSTAMP:20260615T090000");
  });

  it("emits one VEVENT per shift", () => {
    const two = buildICS([EVENT, { ...EVENT, uid: "shift-2@tharros" }]);
    expect(two.match(/BEGIN:VEVENT/g)).toHaveLength(2);
  });
});

describe("googleCalendarUrl", () => {
  it("builds a render URL with encoded title + floating dates", () => {
    const url = googleCalendarUrl(EVENT);
    expect(url.startsWith("https://calendar.google.com/calendar/render?")).toBe(true);
    expect(url).toContain("action=TEMPLATE");
    expect(url).toContain("text=Barista+shift");
    expect(url).toContain("dates=20260615T090000%2F20260615T170000");
    expect(url).toContain("location=Bean+Co");
  });
});
