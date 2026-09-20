import { describe, expect, it } from "vitest";

import { buildEligibility, expandHeads, localSearch, solveSchedule } from "../solver";
import { scoreSolution } from "../score";
import type { CoverageSlot, SolverEmployee, SolverInput } from "../types";
import type { LaborRules } from "../../types";

/** Permissive ruleset (high caps, no rest) — override per test to exercise a rule. */
function rules(overrides: Partial<LaborRules> = {}): LaborRules {
  return {
    org_id: "org-1",
    preset: "custom",
    max_daily_hours: 24,
    max_weekly_hours: 168,
    min_rest_hours_between_shifts: 0,
    overtime_threshold_weekly: 168,
    max_consecutive_days: 14,
    minor_max_daily_hours: 4,
    minor_earliest_start: "06:00",
    minor_latest_end: "22:00",
    params: {},
    updated_at: "2026-06-06T00:00:00.000Z",
    ...overrides,
  };
}

/** Permanent availability for every weekday, whole day. */
const ALWAYS = Array.from({ length: 7 }, (_, d) => ({
  id: "",
  day_of_week: d,
  is_available: true,
  start_time: null,
  end_time: null,
}));

function emp(id: string, overrides: Partial<SolverEmployee> = {}): SolverEmployee {
  return {
    id,
    isMinor: false,
    employmentType: "part_time",
    seniorityRank: null,
    targetHoursWeekly: null,
    minHoursWeekly: null,
    maxHoursWeekly: null,
    performanceScore: null,
    roleIds: [],
    permanent: ALWAYS,
    temporary: [],
    ...overrides,
  };
}

function slot(
  id: string,
  date: string,
  start: string,
  end: string,
  opts: { roleId?: string | null; requiredStaff?: number } = {},
): CoverageSlot {
  return {
    id,
    date,
    startsAt: `${date}T${start}:00Z`,
    endsAt: `${date}T${end}:00Z`,
    roleId: opts.roleId ?? null,
    requiredStaff: opts.requiredStaff ?? 1,
    breakMinutes: 0,
  };
}

function input(
  employees: SolverEmployee[],
  slots: CoverageSlot[],
  laborRules: LaborRules = rules(),
): SolverInput {
  return { employees, slots, laborRules };
}

const MON = "2026-06-08";
const TUE = "2026-06-09";

describe("solveSchedule — coverage", () => {
  it("fills all required heads when staff are plentiful", () => {
    const res = solveSchedule(
      input([emp("a"), emp("b")], [slot("s1", MON, "09:00", "17:00", { requiredStaff: 2 })]),
    );
    expect(res.assignments.every((a) => a.employeeId !== null)).toBe(true);
    expect(res.gapReport[0]).toMatchObject({ required: 2, filled: 2, missing: 0 });
    expect(res.hardViolations).toHaveLength(0);
  });

  it("leaves a gap (open shift) when no eligible employee exists", () => {
    const res = solveSchedule(input([], [slot("s1", MON, "09:00", "17:00")]));
    expect(res.assignments[0].employeeId).toBeNull();
    expect(res.gapReport[0]).toMatchObject({ required: 1, filled: 0, missing: 1 });
    expect(res.gapReport[0].reason).toMatch(/no/i);
  });

  it("never double-books to fill a slot it can't legally cover", () => {
    const res = solveSchedule(
      input([emp("a")], [slot("s1", MON, "09:00", "17:00", { requiredStaff: 2 })]),
    );
    const filled = res.assignments.filter((a) => a.employeeId !== null);
    expect(filled).toHaveLength(1);
    expect(res.gapReport[0].missing).toBe(1);
    expect(res.hardViolations).toHaveLength(0);
  });
});

describe("solveSchedule — hard constraints", () => {
  it("respects availability — only an available employee is assigned", () => {
    const available = emp("a");
    const unavailable = emp("b", { permanent: [] });
    const res = solveSchedule(input([unavailable, available], [slot("s1", MON, "09:00", "17:00")]));
    expect(res.assignments[0].employeeId).toBe("a");
  });

  it("respects role/cert match", () => {
    const barista = emp("a", { roleIds: ["barista"] });
    const cook = emp("b", { roleIds: ["cook"] });
    const res = solveSchedule(
      input([cook, barista], [slot("s1", MON, "09:00", "17:00", { roleId: "barista" })]),
    );
    expect(res.assignments[0].employeeId).toBe("a");
  });

  it("respects a hard daily-hours cap rather than overloading one employee", () => {
    const res = solveSchedule(
      input(
        [emp("a")],
        [slot("s1", MON, "09:00", "17:00"), slot("s2", MON, "17:00", "21:00")],
        rules({ max_daily_hours: 8 }),
      ),
    );
    expect(res.assignments.filter((a) => a.employeeId !== null)).toHaveLength(1);
    expect(res.hardViolations).toHaveLength(0);
  });
});

describe("solveSchedule — soft objectives", () => {
  it("distributes work fairly across identical employees", () => {
    const res = solveSchedule(
      input(
        [emp("a"), emp("b")],
        [slot("s1", MON, "09:00", "17:00"), slot("s2", MON, "18:00", "22:00")],
      ),
    );
    const assigned = res.assignments.map((a) => a.employeeId).sort();
    expect(assigned).toEqual(["a", "b"]);
  });

  it("keeps a low-target employee from being overloaded", () => {
    const light = emp("a", { targetHoursWeekly: 8 });
    const heavy = emp("b", { targetHoursWeekly: 40 });
    const res = solveSchedule(
      input([light, heavy], [slot("s1", MON, "09:00", "17:00"), slot("s2", TUE, "09:00", "17:00")]),
    );
    const lightHeads = res.assignments.filter((a) => a.employeeId === "a");
    expect(lightHeads.length).toBeLessThanOrEqual(1);
  });

  it("breaks ties toward the more-senior employee", () => {
    const senior = emp("a", { seniorityRank: 0 });
    const junior = emp("b", { seniorityRank: 5 });
    const res = solveSchedule(input([junior, senior], [slot("s1", MON, "09:00", "17:00")]));
    expect(res.assignments[0].employeeId).toBe("a");
  });

  it("breaks ties toward the higher performer", () => {
    const strong = emp("a", { performanceScore: 5 });
    const weak = emp("b", { performanceScore: 0 });
    const res = solveSchedule(input([weak, strong], [slot("s1", MON, "09:00", "17:00")]));
    expect(res.assignments[0].employeeId).toBe("a");
  });
});

describe("solveSchedule — determinism & local search", () => {
  const complex = () =>
    input(
      [
        emp("a", { seniorityRank: 1 }),
        emp("b", { seniorityRank: 2 }),
        emp("c", { performanceScore: 3 }),
      ],
      [
        slot("s1", MON, "09:00", "17:00", { requiredStaff: 2 }),
        slot("s2", TUE, "10:00", "18:00"),
        slot("s3", TUE, "12:00", "20:00"),
      ],
    );

  it("produces identical output for identical input", () => {
    expect(solveSchedule(complex())).toEqual(solveSchedule(complex()));
  });

  it("local search never worsens the greedy baseline", () => {
    const greedyOnly = solveSchedule(complex(), { localSearch: false });
    const improved = solveSchedule(complex(), { localSearch: true });
    expect(improved.score.total).toBeLessThanOrEqual(greedyOnly.score.total);
  });

  it("local search repairs a deliberately imbalanced assignment", () => {
    const inp = input(
      [emp("a"), emp("b")],
      [slot("s1", MON, "09:00", "17:00"), slot("s2", MON, "18:00", "22:00")],
    );
    const heads = expandHeads(inp.slots);
    const eligible = buildEligibility(inp.employees, heads);
    const bad = ["a", "a"]; // both heads on one employee — legal but unfair
    const before = scoreSolution(inp, heads, bad).total;
    const after = localSearch(inp, heads, eligible, bad);
    expect(after).toContain("b");
    expect(scoreSolution(inp, heads, after).total).toBeLessThan(before);
  });
});
