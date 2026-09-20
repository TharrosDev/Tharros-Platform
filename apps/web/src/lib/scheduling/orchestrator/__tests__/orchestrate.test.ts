import { describe, expect, it } from "vitest";

import { runOptimizeLoop, type OptimizeAuditEvent, type OptimizeIO } from "../orchestrate";
import { DEFAULT_SOLVER_WEIGHTS } from "../../solver/types";
import type { CoverageSlot, SolverEmployee, SolverInput, SolverResult } from "../../solver/types";
import type { LaborRules } from "../../types";
import type { OptimizeInput } from "../types";

function rules(): LaborRules {
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
  };
}

const ALWAYS = Array.from({ length: 7 }, (_, d) => ({
  id: "",
  day_of_week: d,
  is_available: true,
  start_time: null,
  end_time: null,
}));

const EMP: SolverEmployee = {
  id: "e1",
  isMinor: false,
  employmentType: "part_time",
  seniorityRank: null,
  targetHoursWeekly: null,
  minHoursWeekly: null,
  maxHoursWeekly: 20, // capped + unpinned → both remedies are applicable
  performanceScore: null,
  roleIds: [],
  permanent: ALWAYS,
  temporary: [],
};

const SLOT: CoverageSlot = {
  id: "s1",
  date: "2026-06-08",
  startsAt: "2026-06-08T09:00:00Z",
  endsAt: "2026-06-08T17:00:00Z",
  roleId: null,
  requiredStaff: 1,
  breakMinutes: 0,
};

function input(): OptimizeInput {
  const solverInput: SolverInput = {
    employees: [EMP],
    slots: [SLOT],
    laborRules: rules(),
    weights: { ...DEFAULT_SOLVER_WEIGHTS },
  };
  return { solverInput, pinnedEmployeeIds: [] };
}

const EXHAUSTED = "Qualified, available staff were exhausted or blocked by labor limits.";

function result(missing: number, score = missing * 1000): SolverResult {
  return {
    shifts: [],
    assignments: [
      {
        key: "s1#0",
        slotId: "s1",
        headIndex: 0,
        employeeId: missing > 0 ? null : "e1",
        startsAt: SLOT.startsAt,
        endsAt: SLOT.endsAt,
        roleId: null,
        breakMinutes: 0,
      },
    ],
    gapReport: [
      {
        slotId: "s1",
        date: "2026-06-08",
        roleId: null,
        required: 1,
        filled: missing > 0 ? 0 : 1,
        missing,
        reason: missing > 0 ? EXHAUSTED : "Coverage met.",
      },
    ],
    score: { total: score, breakdown: {} },
    hardViolations: [],
  };
}

/** A solve seam that returns scripted results in order (clamps to the last). */
function scriptedSolve(results: SolverResult[]) {
  let i = 0;
  return (_si: SolverInput): SolverResult => results[Math.min(i++, results.length - 1)];
}

function makeIO(results: SolverResult[], events: OptimizeAuditEvent[]): OptimizeIO {
  return {
    solve: scriptedSolve(results),
    audit: (e) => {
      events.push(e);
    },
    draftEscalationMessage: (esc) => `MSG:${esc.kind}`,
    summarize: () => "SUMMARY",
  };
}

describe("runOptimizeLoop", () => {
  it("returns immediately when the baseline solve is already covered", async () => {
    const events: OptimizeAuditEvent[] = [];
    const res = await runOptimizeLoop({ input: input(), io: makeIO([result(0)], events) });

    expect(res.covered).toBe(true);
    expect(res.trace).toHaveLength(1);
    expect(res.trace[0].remedy).toBeNull();
    expect(res.escalations).toHaveLength(0);
    expect(res.summary).toBe("SUMMARY");
    expect(events.map((e) => e.action)).toEqual([
      "optimize_started",
      "solve_attempt",
      "optimize_completed",
    ]);
  });

  it("applies remedies until coverage is met", async () => {
    const events: OptimizeAuditEvent[] = [];
    // baseline gap → first remedy still gap → second remedy covers it
    const res = await runOptimizeLoop({
      input: input(),
      io: makeIO([result(1), result(1), result(0)], events),
    });

    expect(res.covered).toBe(true);
    expect(res.trace.map((s) => s.remedy?.kind ?? "baseline")).toEqual([
      "baseline",
      "disable_labor_soft",
      "raise_unpinned_max_hours",
    ]);
    expect(res.escalations).toHaveLength(0);
    expect(events.filter((e) => e.action === "remedy_applied")).toHaveLength(2);
  });

  it("escalates when the ladder is exhausted and gaps remain", async () => {
    const events: OptimizeAuditEvent[] = [];
    const res = await runOptimizeLoop({
      input: input(),
      io: makeIO([result(1), result(1), result(1)], events),
    });

    expect(res.covered).toBe(false);
    expect(res.trace).toHaveLength(3); // baseline + 2 remedies, then ladder exhausted
    expect(res.escalations).toHaveLength(1);
    expect(res.escalations[0]).toMatchObject({
      kind: "propose_overtime",
      slotId: "s1",
      draftMessage: "MSG:propose_overtime",
      employeeIds: ["e1"],
    });
    expect(events.filter((e) => e.action === "escalation_emitted")).toHaveLength(1);
  });

  it("honors the maxRounds backstop even when remedies remain", async () => {
    const events: OptimizeAuditEvent[] = [];
    const res = await runOptimizeLoop({
      input: input(),
      io: makeIO([result(1), result(1), result(0)], events),
      maxRounds: 1,
    });

    // stopped after one remedy round → still uncovered, escalates
    expect(res.trace).toHaveLength(2);
    expect(res.covered).toBe(false);
    expect(events.filter((e) => e.action === "remedy_applied")).toHaveLength(1);
  });

  it("is deterministic — identical inputs produce an identical trace", async () => {
    const a: OptimizeAuditEvent[] = [];
    const b: OptimizeAuditEvent[] = [];
    const r1 = await runOptimizeLoop({ input: input(), io: makeIO([result(1), result(0)], a) });
    const r2 = await runOptimizeLoop({ input: input(), io: makeIO([result(1), result(0)], b) });
    expect(r1.trace).toEqual(r2.trace);
  });
});
