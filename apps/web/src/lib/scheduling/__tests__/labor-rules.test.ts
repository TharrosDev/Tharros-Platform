import { describe, expect, it } from "vitest";

import { LABOR_RULE_PRESETS } from "../presets";
import {
  shiftHours,
  validateLaborRules,
  validateMaxConsecutiveDays,
  validateMaxDailyHours,
  validateMaxWeeklyHours,
  validateMinRest,
  validateMinorRestrictions,
  validateOvertimeThreshold,
} from "../labor-rules";
import type { EmployeeContext, LaborRules, ShiftInput } from "../types";

// All timestamps use "Z" so UTC == the wall clock the rules reason about.
const EMP = "emp-1";

/** A ruleset with explicit values; spread to override per test. */
function rules(overrides: Partial<LaborRules> = {}): LaborRules {
  return {
    org_id: "org-1",
    preset: "custom",
    max_daily_hours: 8,
    max_weekly_hours: 40,
    min_rest_hours_between_shifts: 8,
    overtime_threshold_weekly: 38,
    max_consecutive_days: 5,
    minor_max_daily_hours: 4,
    minor_earliest_start: "06:00",
    minor_latest_end: "22:00",
    params: {},
    updated_at: "2026-06-06T00:00:00.000Z",
    ...overrides,
  };
}

function shift(
  startsAt: string,
  endsAt: string,
  opts: { employeeId?: string | null; breakMinutes?: number; id?: string } = {},
): ShiftInput {
  return {
    id: opts.id,
    employeeId: opts.employeeId === undefined ? EMP : opts.employeeId,
    startsAt,
    endsAt,
    breakMinutes: opts.breakMinutes ?? 0,
  };
}

describe("shiftHours", () => {
  it("subtracts the unpaid break", () => {
    expect(
      shiftHours(shift("2026-06-08T09:00:00Z", "2026-06-08T17:30:00Z", { breakMinutes: 30 })),
    ).toBe(8);
  });

  it("handles an overnight shift crossing midnight", () => {
    expect(shiftHours(shift("2026-06-08T22:00:00Z", "2026-06-09T06:00:00Z"))).toBe(8);
  });
});

describe("validateMaxDailyHours", () => {
  it("passes at exactly the daily cap", () => {
    expect(
      validateMaxDailyHours([shift("2026-06-08T09:00:00Z", "2026-06-08T17:00:00Z")], rules()),
    ).toHaveLength(0);
  });

  it("flags a hard violation over the cap (summing multiple same-day shifts)", () => {
    const v = validateMaxDailyHours(
      [
        shift("2026-06-08T08:00:00Z", "2026-06-08T13:00:00Z"),
        shift("2026-06-08T14:00:00Z", "2026-06-08T18:00:00Z"),
      ],
      rules(),
    );
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ rule: "max_daily_hours", severity: "hard", employeeId: EMP });
    expect(v[0].details).toMatchObject({ hours: 9, max: 8 });
  });

  it("ignores open (unassigned) shifts", () => {
    const v = validateMaxDailyHours(
      [shift("2026-06-08T06:00:00Z", "2026-06-08T20:00:00Z", { employeeId: null })],
      rules(),
    );
    expect(v).toHaveLength(0);
  });
});

describe("validateMaxWeeklyHours", () => {
  it("flags a hard violation when the week total exceeds the cap", () => {
    const days = ["08", "09", "10", "11", "12"]; // Mon–Fri, same ISO week
    const shifts = days.map((d) => shift(`2026-06-${d}T09:00:00Z`, `2026-06-${d}T18:00:00Z`)); // 9h each = 45h
    const v = validateMaxWeeklyHours(shifts, rules());
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ rule: "max_weekly_hours", severity: "hard" });
    expect(v[0].details).toMatchObject({ hours: 45, max: 40 });
  });

  it("does not flag when hours split across two ISO weeks", () => {
    const v = validateMaxWeeklyHours(
      [
        shift("2026-06-12T09:00:00Z", "2026-06-12T18:00:00Z"), // Fri week 24
        shift("2026-06-15T09:00:00Z", "2026-06-15T18:00:00Z"), // Mon week 25
      ],
      rules(),
    );
    expect(v).toHaveLength(0);
  });
});

describe("validateOvertimeThreshold", () => {
  it("raises a soft flag past the OT threshold but under the weekly max", () => {
    const days = ["08", "09", "10", "11"];
    const shifts = days.map((d) => shift(`2026-06-${d}T09:00:00Z`, `2026-06-${d}T19:00:00Z`)); // 10h each = 40h
    const v = validateOvertimeThreshold(
      shifts,
      rules({ overtime_threshold_weekly: 38, max_weekly_hours: 48 }),
    );
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ rule: "overtime_threshold", severity: "soft" });
  });
});

describe("validateMinRest", () => {
  it("flags too little rest between consecutive shifts", () => {
    const v = validateMinRest(
      [
        shift("2026-06-08T22:00:00Z", "2026-06-09T02:00:00Z", { id: "s1" }),
        shift("2026-06-09T08:00:00Z", "2026-06-09T16:00:00Z", { id: "s2" }), // only 6h rest
      ],
      rules(),
    );
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({
      rule: "min_rest_between_shifts",
      severity: "hard",
      shiftId: "s2",
    });
    expect(v[0].details).toMatchObject({ restHours: 6, min: 8 });
  });

  it("passes at exactly the minimum rest", () => {
    const v = validateMinRest(
      [
        shift("2026-06-08T08:00:00Z", "2026-06-08T16:00:00Z"),
        shift("2026-06-09T00:00:00Z", "2026-06-09T08:00:00Z"), // exactly 8h rest
      ],
      rules(),
    );
    expect(v).toHaveLength(0);
  });
});

describe("validateMaxConsecutiveDays", () => {
  it("raises a soft flag past the consecutive-day limit", () => {
    const days = ["08", "09", "10", "11", "12", "13"]; // 6 in a row, max 5
    const shifts = days.map((d) => shift(`2026-06-${d}T09:00:00Z`, `2026-06-${d}T13:00:00Z`));
    const v = validateMaxConsecutiveDays(shifts, rules());
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ rule: "max_consecutive_days", severity: "soft" });
    expect(v[0].details).toMatchObject({ consecutiveDays: 6, max: 5 });
  });

  it("does not flag a gap that breaks the run", () => {
    const days = ["08", "09", "10", "12", "13"]; // gap on the 11th
    const shifts = days.map((d) => shift(`2026-06-${d}T09:00:00Z`, `2026-06-${d}T13:00:00Z`));
    expect(validateMaxConsecutiveDays(shifts, rules())).toHaveLength(0);
  });
});

describe("validateMinorRestrictions", () => {
  const minor: EmployeeContext = { id: EMP, isMinor: true };
  const adult: EmployeeContext = { id: EMP, isMinor: false };
  const byId = (e: EmployeeContext) => new Map([[e.id, e]]);

  it("ignores non-minors entirely", () => {
    const v = validateMinorRestrictions(
      [shift("2026-06-08T05:00:00Z", "2026-06-08T11:00:00Z")], // 6h, before 06:00
      rules(),
      byId(adult),
    );
    expect(v).toHaveLength(0);
  });

  it("flags a minor over the minor daily cap", () => {
    const v = validateMinorRestrictions(
      [shift("2026-06-08T10:00:00Z", "2026-06-08T15:00:00Z")], // 5h > 4h minor cap, within window
      rules(),
      byId(minor),
    );
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ rule: "minor_max_daily_hours", severity: "hard" });
  });

  it("flags a minor shift outside the permitted time window", () => {
    const v = validateMinorRestrictions(
      [shift("2026-06-08T09:00:00Z", "2026-06-08T23:30:00Z", { id: "late" })], // ends after 22:00
      rules({ minor_max_daily_hours: null }), // isolate the window rule
      byId(minor),
    );
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ rule: "minor_hours_window", severity: "hard", shiftId: "late" });
    expect(v[0].details).toMatchObject({ tooLate: true });
  });

  it("treats an overnight minor shift as outside the window", () => {
    const v = validateMinorRestrictions(
      [shift("2026-06-08T20:00:00Z", "2026-06-09T02:00:00Z")],
      rules({ minor_max_daily_hours: null }),
      byId(minor),
    );
    expect(v.some((x) => x.rule === "minor_hours_window")).toBe(true);
  });
});

describe("validateLaborRules", () => {
  it("returns no violations for an empty shift list", () => {
    expect(validateLaborRules([], rules(), [])).toHaveLength(0);
  });

  it("aggregates across rules and tags severity", () => {
    // A minor working a 10h day, late, then too little rest before the next day.
    const shifts = [
      shift("2026-06-08T09:00:00Z", "2026-06-08T23:00:00Z", { id: "a" }), // 14h, ends 23:00
      shift("2026-06-09T03:00:00Z", "2026-06-09T07:00:00Z", { id: "b" }), // 4h rest
    ];
    const v = validateLaborRules(shifts, rules(), [{ id: EMP, isMinor: true }]);
    const ruleKeys = new Set(v.map((x) => x.rule));
    expect(ruleKeys).toContain("max_daily_hours");
    expect(ruleKeys).toContain("min_rest_between_shifts");
    expect(ruleKeys).toContain("minor_max_daily_hours");
    expect(ruleKeys).toContain("minor_hours_window");
    expect(v.every((x) => x.severity === "hard" || x.severity === "soft")).toBe(true);
  });
});

describe("presets", () => {
  it("ontario preset uses ESA-style values", () => {
    expect(LABOR_RULE_PRESETS.ontario).toMatchObject({
      min_rest_hours_between_shifts: 11,
      overtime_threshold_weekly: 44,
    });
  });
});
