import { describe, expect, it } from "vitest";

import { isAvailable } from "../availability";
import type { CoverageSlot, SolverEmployee } from "../types";
import type { PermanentRow, TemporaryRow } from "../../queries";

/** A slot on a concrete date with an HH:MM window (local-as-UTC). */
function slot(date: string, start: string, end: string): CoverageSlot {
  return {
    id: "s1",
    date,
    startsAt: `${date}T${start}:00Z`,
    endsAt: `${date}T${end}:00Z`,
    roleId: null,
    requiredStaff: 1,
    breakMinutes: 0,
  };
}

function dow(date: string): number {
  return new Date(Date.parse(`${date}T00:00:00Z`)).getUTCDay();
}

function permanent(day: number, opts: Partial<PermanentRow> = {}): PermanentRow {
  return { id: "", day_of_week: day, is_available: true, start_time: null, end_time: null, ...opts };
}

function temporary(opts: Partial<TemporaryRow> & { effective_date: string }): TemporaryRow {
  return {
    id: "",
    end_date: null,
    is_available: true,
    start_time: null,
    end_time: null,
    notes: null,
    ...opts,
  };
}

function emp(overrides: Partial<SolverEmployee> = {}): SolverEmployee {
  return {
    id: "e1",
    isMinor: false,
    employmentType: "part_time",
    seniorityRank: null,
    targetHoursWeekly: null,
    minHoursWeekly: null,
    maxHoursWeekly: null,
    performanceScore: null,
    roleIds: [],
    permanent: [],
    temporary: [],
    ...overrides,
  };
}

const DATE = "2026-06-08"; // a fixed Monday in the period

describe("isAvailable — permanent grid", () => {
  it("is available on a whole-day permanent weekday", () => {
    const e = emp({ permanent: [permanent(dow(DATE))] });
    expect(isAvailable(e, slot(DATE, "09:00", "17:00"))).toBe(true);
  });

  it("is unavailable with no permanent or temporary rows (whitelist)", () => {
    expect(isAvailable(emp(), slot(DATE, "09:00", "17:00"))).toBe(false);
  });

  it("is unavailable when the permanent row is for a different weekday", () => {
    const e = emp({ permanent: [permanent((dow(DATE) + 1) % 7)] });
    expect(isAvailable(e, slot(DATE, "09:00", "17:00"))).toBe(false);
  });

  it("respects a narrower permanent time window", () => {
    const e = emp({ permanent: [permanent(dow(DATE), { start_time: "12:00", end_time: "20:00" })] });
    expect(isAvailable(e, slot(DATE, "09:00", "17:00"))).toBe(false); // starts before window
    expect(isAvailable(e, slot(DATE, "13:00", "19:00"))).toBe(true); // inside window
  });
});

describe("isAvailable — temporary overrides take precedence", () => {
  it("an available override grants a day the permanent grid doesn't", () => {
    const e = emp({ permanent: [], temporary: [temporary({ effective_date: DATE })] });
    expect(isAvailable(e, slot(DATE, "09:00", "17:00"))).toBe(true);
  });

  it("an unavailable override blocks a day the permanent grid allows", () => {
    const e = emp({
      permanent: [permanent(dow(DATE))],
      temporary: [temporary({ effective_date: DATE, is_available: false })],
    });
    expect(isAvailable(e, slot(DATE, "09:00", "17:00"))).toBe(false);
  });

  it("an available override whose window excludes the slot leaves it off", () => {
    const e = emp({
      permanent: [permanent(dow(DATE))],
      temporary: [temporary({ effective_date: DATE, start_time: "18:00", end_time: "22:00" })],
    });
    expect(isAvailable(e, slot(DATE, "09:00", "17:00"))).toBe(false);
  });

  it("honors a multi-day override range", () => {
    const e = emp({
      permanent: [],
      temporary: [temporary({ effective_date: "2026-06-07", end_date: "2026-06-10" })],
    });
    expect(isAvailable(e, slot(DATE, "09:00", "17:00"))).toBe(true);
  });
});
