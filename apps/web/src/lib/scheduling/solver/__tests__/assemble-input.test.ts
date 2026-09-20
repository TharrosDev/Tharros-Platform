import { describe, expect, it } from "vitest";

import { assembleSolverInput } from "../assemble-input";
import type { AssembleSolverInputArgs, RawBusinessHours, RawStaffing } from "../assemble-input";
import type { LaborRules } from "../../types";

function laborRules(): LaborRules {
  return {
    org_id: "org-1",
    preset: "custom",
    max_daily_hours: 12,
    max_weekly_hours: 48,
    min_rest_hours_between_shifts: 8,
    overtime_threshold_weekly: 44,
    max_consecutive_days: 6,
    minor_max_daily_hours: null,
    minor_earliest_start: null,
    minor_latest_end: null,
    params: {},
    updated_at: "2026-06-06T00:00:00.000Z",
  };
}

function dow(date: string): number {
  return new Date(Date.parse(`${date}T00:00:00Z`)).getUTCDay();
}

const MON = "2026-06-08";
const SUN = "2026-06-14";

function args(overrides: Partial<AssembleSolverInputArgs> = {}): AssembleSolverInputArgs {
  return {
    periodStart: MON,
    periodEnd: SUN,
    employees: [],
    roleAssignments: [],
    availability: [],
    businessHours: [],
    staffing: [],
    laborRules: laborRules(),
    ...overrides,
  };
}

function staffing(overrides: Partial<RawStaffing> = {}): RawStaffing {
  return {
    id: "req1",
    role_certification_id: null,
    day_of_week: dow(MON),
    specific_date: null,
    start_time: "09:00:00",
    end_time: "17:00:00",
    min_staff: 1,
    ...overrides,
  };
}

describe("assembleSolverInput — slot expansion", () => {
  it("expands a recurring weekday requirement to each matching date in the period", () => {
    const out = assembleSolverInput(args({ staffing: [staffing({ day_of_week: dow(MON) })] }));
    expect(out.slots).toHaveLength(1); // only one Monday in this 7-day window
    expect(out.slots[0]).toMatchObject({
      date: MON,
      startsAt: `${MON}T09:00:00Z`,
      endsAt: `${MON}T17:00:00Z`,
      requiredStaff: 1,
    });
  });

  it("carries min_staff through to requiredStaff", () => {
    const out = assembleSolverInput(args({ staffing: [staffing({ min_staff: 3 })] }));
    expect(out.slots[0].requiredStaff).toBe(3);
  });

  it("expands a specific-date requirement to exactly that date", () => {
    const out = assembleSolverInput(
      args({ staffing: [staffing({ day_of_week: null, specific_date: "2026-06-10" })] }),
    );
    expect(out.slots.map((s) => s.date)).toEqual(["2026-06-10"]);
  });

  it("excludes dates the org is closed", () => {
    const closed: RawBusinessHours = {
      day_of_week: dow(MON),
      opens_at: null,
      closes_at: null,
      is_closed: true,
    };
    const out = assembleSolverInput(
      args({ staffing: [staffing({ day_of_week: dow(MON) })], businessHours: [closed] }),
    );
    expect(out.slots).toHaveLength(0);
  });
});

describe("assembleSolverInput — roles & cert expiry", () => {
  const employee = {
    id: "e1",
    is_minor: false,
    employment_type: "part_time" as const,
    seniority_rank: null,
    target_hours_weekly: null,
    min_hours_weekly: null,
    max_hours_weekly: null,
    performance_score: null,
  };

  it("includes a role with no expiry and one valid through the period", () => {
    const out = assembleSolverInput(
      args({
        employees: [employee],
        roleAssignments: [
          { employee_id: "e1", role_certification_id: "role-keep", expires_at: null },
          { employee_id: "e1", role_certification_id: "cert-valid", expires_at: "2026-12-31" },
        ],
      }),
    );
    expect(out.employees[0].roleIds.sort()).toEqual(["cert-valid", "role-keep"]);
  });

  it("drops a certification that lapses before the period ends", () => {
    const out = assembleSolverInput(
      args({
        employees: [employee],
        roleAssignments: [
          { employee_id: "e1", role_certification_id: "cert-expired", expires_at: "2026-06-01" },
        ],
      }),
    );
    expect(out.employees[0].roleIds).toEqual([]);
  });

  it("coerces PostgREST numeric strings on roster fields", () => {
    const out = assembleSolverInput(
      args({ employees: [{ ...employee, seniority_rank: "2", target_hours_weekly: "37.5" }] }),
    );
    expect(out.employees[0].seniorityRank).toBe(2);
    expect(out.employees[0].targetHoursWeekly).toBe(37.5);
  });
});
