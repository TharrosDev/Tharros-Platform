import { describe, expect, it } from "vitest";

import { nextRemedy, applyRemedy, selectEscalations, totalMissing } from "../remedies";
import { DEFAULT_SOLVER_WEIGHTS } from "../../solver/types";
import type { CoverageSlot, GapReportEntry, SolverEmployee, SolverInput } from "../../solver/types";
import type { LaborRules } from "../../types";
import type { OptimizeInput, RemedyKind } from "../types";

/** Permissive ruleset (mirrors the solver tests). */
function rules(overrides: Partial<LaborRules> = {}): LaborRules {
  return {
    org_id: "org-1",
    preset: "custom",
    max_daily_hours: 24,
    max_weekly_hours: 168,
    min_rest_hours_between_shifts: 0,
    overtime_threshold_weekly: 40,
    max_consecutive_days: 14,
    minor_max_daily_hours: 4,
    minor_earliest_start: "06:00",
    minor_latest_end: "22:00",
    params: {},
    updated_at: "2026-06-06T00:00:00.000Z",
    ...overrides,
  };
}

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

function slot(id: string, overrides: Partial<CoverageSlot> = {}): CoverageSlot {
  return {
    id,
    date: "2026-06-08",
    startsAt: "2026-06-08T09:00:00Z",
    endsAt: "2026-06-08T17:00:00Z",
    roleId: null,
    requiredStaff: 1,
    breakMinutes: 0,
    ...overrides,
  };
}

function optimizeInput(
  employees: SolverEmployee[],
  slots: CoverageSlot[],
  opts: { pinnedEmployeeIds?: string[]; weights?: Partial<typeof DEFAULT_SOLVER_WEIGHTS> } = {},
): OptimizeInput {
  const solverInput: SolverInput = {
    employees,
    slots,
    laborRules: rules(),
    weights: { ...DEFAULT_SOLVER_WEIGHTS, ...(opts.weights ?? {}) },
  };
  return { solverInput, pinnedEmployeeIds: opts.pinnedEmployeeIds ?? [] };
}

function gap(reason: string, missing = 1): GapReportEntry {
  return {
    slotId: "s1",
    date: "2026-06-08",
    roleId: null,
    required: 1,
    filled: 0,
    missing,
    reason,
  };
}

describe("totalMissing", () => {
  it("sums positive missing heads and ignores zeros", () => {
    expect(totalMissing([gap("x", 2), gap("y", 0), gap("z", 1)])).toBe(3);
  });
});

describe("nextRemedy — ladder ordering", () => {
  it("tries disable_labor_soft first, then raise_unpinned_max_hours, then null", () => {
    const input = optimizeInput([emp("a", { maxHoursWeekly: 20 })], [slot("s1")]);

    const r1 = nextRemedy([], input);
    expect(r1?.kind).toBe("disable_labor_soft");

    const r2 = nextRemedy(["disable_labor_soft"], input);
    expect(r2?.kind).toBe("raise_unpinned_max_hours");

    const r3 = nextRemedy(["disable_labor_soft", "raise_unpinned_max_hours"], input);
    expect(r3).toBeNull();
  });

  it("skips disable_labor_soft when laborSoft is already 0", () => {
    const input = optimizeInput([emp("a", { maxHoursWeekly: 20 })], [slot("s1")], {
      weights: { laborSoft: 0 },
    });
    expect(nextRemedy([], input)?.kind).toBe("raise_unpinned_max_hours");
  });

  it("skips raise_unpinned_max_hours when every capped employee is pinned", () => {
    const input = optimizeInput([emp("a", { maxHoursWeekly: 20 })], [slot("s1")], {
      pinnedEmployeeIds: ["a"],
      weights: { laborSoft: 0 },
    });
    expect(nextRemedy([], input)).toBeNull();
  });

  it("skips raise_unpinned_max_hours when no employee has a cap", () => {
    const input = optimizeInput([emp("a")], [slot("s1")], { weights: { laborSoft: 0 } });
    expect(nextRemedy([], input)).toBeNull();
  });
});

describe("applyRemedy — copy-on-write", () => {
  it("disable_labor_soft zeroes laborSoft and preserves the other weights", () => {
    const input = optimizeInput([emp("a", { maxHoursWeekly: 20 })], [slot("s1")]);
    const out = applyRemedy(input, { kind: "disable_labor_soft", note: "" });

    expect(out.solverInput.weights?.laborSoft).toBe(0);
    expect(out.solverInput.weights?.coverageGapPenalty).toBe(
      DEFAULT_SOLVER_WEIGHTS.coverageGapPenalty,
    );
    // original untouched
    expect(input.solverInput.weights?.laborSoft).toBe(DEFAULT_SOLVER_WEIGHTS.laborSoft);
  });

  it("raise_unpinned_max_hours nulls unpinned caps but leaves pinned ones", () => {
    const input = optimizeInput(
      [emp("a", { maxHoursWeekly: 20 }), emp("b", { maxHoursWeekly: 25 }), emp("c")],
      [slot("s1")],
      { pinnedEmployeeIds: ["b"] },
    );
    const out = applyRemedy(input, { kind: "raise_unpinned_max_hours", note: "" });
    const byId = new Map(out.solverInput.employees.map((e) => [e.id, e]));

    expect(byId.get("a")?.maxHoursWeekly).toBeNull(); // unpinned → lifted
    expect(byId.get("b")?.maxHoursWeekly).toBe(25); // pinned → kept
    expect(byId.get("c")?.maxHoursWeekly).toBeNull(); // already null
    // original untouched
    expect(input.solverInput.employees[0].maxHoursWeekly).toBe(20);
  });
});

describe("selectEscalations — classification + candidates", () => {
  it("maps each gap reason to the right escalation kind and employee set", () => {
    const employees = [
      emp("qualified-available", { roleIds: ["r1"] }),
      emp("qualified-unavailable", { roleIds: ["r1"], permanent: [], temporary: [] }),
    ];
    const input = optimizeInput(employees, [slot("s1", { roleId: "r1" })]);

    const noRole = selectEscalations([gap("No employee holds the required role.")], input);
    expect(noRole[0]).toMatchObject({ kind: "manager_decision", employeeIds: [] });

    const noAvail = selectEscalations(
      [gap("No qualified employee is available for this window.")],
      input,
    );
    expect(noAvail[0].kind).toBe("request_availability");
    // every qualified person can be asked to add availability
    expect(noAvail[0].employeeIds.sort()).toEqual(["qualified-available", "qualified-unavailable"]);

    const exhausted = selectEscalations(
      [gap("Qualified, available staff were exhausted or blocked by labor limits.")],
      input,
    );
    expect(exhausted[0].kind).toBe("propose_overtime");
    // only the available, qualified person is an OT candidate
    expect(exhausted[0].employeeIds).toEqual(["qualified-available"]);
  });

  it("ignores filled slots and leaves draftMessage empty (the loop fills it)", () => {
    const input = optimizeInput([emp("a")], [slot("s1")]);
    const out = selectEscalations([gap("Coverage met.", 0), gap("x", 1)], input);
    expect(out).toHaveLength(1);
    expect(out[0].draftMessage).toBe("");
  });
});

// Type guard: the ladder constant covers exactly the RemedyKind union.
const _kinds: RemedyKind[] = ["disable_labor_soft", "raise_unpinned_max_hours"];
void _kinds;
