import { describe, expect, it } from "vitest";

import {
  validateAvailability,
  validateEdits,
  validateNoDoubleBooking,
  validateRoleQualification,
  type EditShift,
  type ValidationContext,
  type ValidationEmployee,
} from "../validation";
import type { LaborRules } from "../types";
import type { PermanentRow } from "../queries";

// All timestamps use "Z" so UTC == the wall clock the rules reason about.
const EMP = "emp-1";

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

function weekday(date: string): number {
  return new Date(Date.parse(`${date}T00:00:00Z`)).getUTCDay();
}

function perm(dayOfWeek: number, start: string | null, end: string | null): PermanentRow {
  return { id: "", day_of_week: dayOfWeek, is_available: true, start_time: start, end_time: end };
}

function emp(overrides: Partial<ValidationEmployee> = {}): ValidationEmployee {
  return {
    id: EMP,
    isMinor: false,
    roleIds: [],
    permanent: [],
    temporary: [],
    ...overrides,
  };
}

function shift(
  startsAt: string,
  endsAt: string,
  opts: { employeeId?: string | null; roleId?: string | null; id?: string; breakMinutes?: number } = {},
): EditShift {
  return {
    id: opts.id,
    employeeId: opts.employeeId === undefined ? EMP : opts.employeeId,
    roleId: opts.roleId ?? null,
    startsAt,
    endsAt,
    breakMinutes: opts.breakMinutes ?? 0,
  };
}

const MAP = (employees: ValidationEmployee[]) => new Map(employees.map((e) => [e.id, e]));

describe("validateNoDoubleBooking", () => {
  it("flags two overlapping shifts for the same employee", () => {
    const v = validateNoDoubleBooking([
      shift("2026-06-08T09:00:00Z", "2026-06-08T13:00:00Z", { id: "a" }),
      shift("2026-06-08T12:00:00Z", "2026-06-08T16:00:00Z", { id: "b" }),
    ]);
    expect(v).toHaveLength(1);
    expect(v[0].rule).toBe("double_booking");
    expect(v[0].severity).toBe("hard");
    expect(v[0].shiftId).toBe("b");
  });

  it("allows back-to-back non-overlapping shifts", () => {
    const v = validateNoDoubleBooking([
      shift("2026-06-08T09:00:00Z", "2026-06-08T12:00:00Z", { id: "a" }),
      shift("2026-06-08T12:00:00Z", "2026-06-08T15:00:00Z", { id: "b" }),
    ]);
    expect(v).toHaveLength(0);
  });

  it("never flags open (unassigned) shifts even when they overlap", () => {
    const v = validateNoDoubleBooking([
      shift("2026-06-08T09:00:00Z", "2026-06-08T13:00:00Z", { employeeId: null, id: "a" }),
      shift("2026-06-08T10:00:00Z", "2026-06-08T14:00:00Z", { employeeId: null, id: "b" }),
    ]);
    expect(v).toHaveLength(0);
  });
});

describe("validateAvailability", () => {
  const MON = "2026-06-08";

  it("passes a shift inside the employee's permanent window", () => {
    const employee = emp({ permanent: [perm(weekday(MON), "08:00", "18:00")] });
    const v = validateAvailability(
      [shift(`${MON}T09:00:00Z`, `${MON}T17:00:00Z`)],
      MAP([employee]),
    );
    expect(v).toHaveLength(0);
  });

  it("flags a shift on a day the employee isn't available", () => {
    // Available Mondays only; schedule them the day before.
    const employee = emp({ permanent: [perm(weekday(MON), "08:00", "18:00")] });
    const sun = "2026-06-07";
    const v = validateAvailability(
      [shift(`${sun}T09:00:00Z`, `${sun}T17:00:00Z`)],
      MAP([employee]),
    );
    expect(v).toHaveLength(1);
    expect(v[0].rule).toBe("availability_conflict");
    expect(v[0].severity).toBe("hard");
  });

  it("flags a shift that runs past the available window", () => {
    const employee = emp({ permanent: [perm(weekday(MON), "08:00", "12:00")] });
    const v = validateAvailability(
      [shift(`${MON}T09:00:00Z`, `${MON}T17:00:00Z`)],
      MAP([employee]),
    );
    expect(v).toHaveLength(1);
    expect(v[0].rule).toBe("availability_conflict");
  });

  it("skips employees missing from the context map", () => {
    const v = validateAvailability([shift(`${MON}T09:00:00Z`, `${MON}T17:00:00Z`)], MAP([]));
    expect(v).toHaveLength(0);
  });
});

describe("validateRoleQualification", () => {
  it("passes when the employee holds the required role", () => {
    const employee = emp({ roleIds: ["role-a"] });
    const v = validateRoleQualification(
      [shift("2026-06-08T09:00:00Z", "2026-06-08T17:00:00Z", { roleId: "role-a" })],
      MAP([employee]),
    );
    expect(v).toHaveLength(0);
  });

  it("flags when the employee lacks the required role", () => {
    const employee = emp({ roleIds: ["role-a"] });
    const v = validateRoleQualification(
      [shift("2026-06-08T09:00:00Z", "2026-06-08T17:00:00Z", { roleId: "role-b" })],
      MAP([employee]),
    );
    expect(v).toHaveLength(1);
    expect(v[0].rule).toBe("role_unqualified");
    expect(v[0].severity).toBe("hard");
  });

  it("ignores shifts with no required role", () => {
    const employee = emp({ roleIds: [] });
    const v = validateRoleQualification(
      [shift("2026-06-08T09:00:00Z", "2026-06-08T17:00:00Z", { roleId: null })],
      MAP([employee]),
    );
    expect(v).toHaveLength(0);
  });
});

describe("validateEdits (composition)", () => {
  it("surfaces a hard labor violation alongside the edit checks", () => {
    // Two same-day shifts 2h apart → under the 8h min-rest (hard), no overlap.
    const ctx: ValidationContext = { laborRules: rules(), employees: [] };
    const v = validateEdits(
      [
        shift("2026-06-08T08:00:00Z", "2026-06-08T12:00:00Z", { id: "a" }),
        shift("2026-06-08T14:00:00Z", "2026-06-08T18:00:00Z", { id: "b" }),
      ],
      ctx,
    );
    const hard = v.filter((x) => x.severity === "hard");
    expect(hard.some((x) => x.rule === "min_rest_between_shifts")).toBe(true);
  });

  it("keeps soft labor flags soft and reports a clean set otherwise", () => {
    const MON = "2026-06-08";
    const employee = emp({ permanent: [perm(weekday(MON), null, null)], roleIds: ["role-a"] });
    const ctx: ValidationContext = { laborRules: rules(), employees: [employee] };
    const v = validateEdits(
      [shift(`${MON}T09:00:00Z`, `${MON}T15:00:00Z`, { roleId: "role-a" })],
      ctx,
    );
    expect(v.filter((x) => x.severity === "hard")).toHaveLength(0);
  });

  it("aggregates a double-booking with an availability conflict", () => {
    const sun = "2026-06-07";
    const employee = emp({ permanent: [] }); // never available
    const ctx: ValidationContext = { laborRules: rules(), employees: [employee] };
    const v = validateEdits(
      [
        shift(`${sun}T09:00:00Z`, `${sun}T13:00:00Z`, { id: "a" }),
        shift(`${sun}T12:00:00Z`, `${sun}T16:00:00Z`, { id: "b" }),
      ],
      ctx,
    );
    expect(v.some((x) => x.rule === "double_booking")).toBe(true);
    expect(v.some((x) => x.rule === "availability_conflict")).toBe(true);
  });
});
