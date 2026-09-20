import { describe, expect, it } from "vitest";

import { candidateMetrics, type MetricsRosterEntry } from "../metrics";
import type { OptimizeResult } from "../../orchestrator/types";
import type { Assignment, GapReportEntry } from "../../solver/types";

const DAY = "2026-06-08";

function assign(
  employeeId: string | null,
  start: string,
  end: string,
  opts: { key?: string; breakMinutes?: number } = {},
): Assignment {
  return {
    key: opts.key ?? `${employeeId}-${start}`,
    slotId: "s1",
    headIndex: 0,
    employeeId,
    startsAt: `${DAY}T${start}:00Z`,
    endsAt: `${DAY}T${end}:00Z`,
    roleId: null,
    breakMinutes: opts.breakMinutes ?? 0,
  };
}

function gap(required: number, filled: number, reason = "Coverage met."): GapReportEntry {
  return {
    slotId: "s1",
    date: DAY,
    roleId: null,
    required,
    filled,
    missing: required - filled,
    reason,
  };
}

function result(over: Partial<OptimizeResult> = {}): OptimizeResult {
  return {
    threadId: null,
    schedule: { assignments: over.schedule?.assignments ?? [], shifts: [] },
    gapReport: over.gapReport ?? [gap(1, 1)],
    covered: over.covered ?? true,
    trace: over.trace ?? [{ round: 0, remedy: null, score: 42, totalMissing: 0 }],
    escalations: over.escalations ?? [],
    summary: "",
  };
}

const roster = (ranks: Record<string, number | null>): MetricsRosterEntry[] =>
  Object.entries(ranks).map(([id, seniorityRank]) => ({ id, seniorityRank }));

describe("candidateMetrics", () => {
  it("derives coverage + solver score from the gap report and trace", () => {
    const m = candidateMetrics(
      result({
        gapReport: [gap(3, 2)],
        covered: false,
        trace: [{ round: 0, remedy: null, score: 1000, totalMissing: 1 }],
      }),
      roster({ a: null }),
      40,
    );
    expect(m).toMatchObject({
      totalRequired: 3,
      totalFilled: 2,
      totalMissing: 1,
      covered: false,
      solverScore: 1000,
    });
    expect(m.coverageRatio).toBeCloseTo(2 / 3);
  });

  it("computes fairness as the std-dev of per-employee hours across the roster", () => {
    // a + b each work 8h → perfectly fair → stddev 0
    const even = candidateMetrics(
      result({
        schedule: {
          assignments: [assign("a", "09:00", "17:00"), assign("b", "09:00", "17:00")],
          shifts: [],
        },
      }),
      roster({ a: null, b: null }),
      40,
    );
    expect(even.totalHours).toBe(16);
    expect(even.fairnessStdDev).toBe(0);

    // a works 8h, b works 0h → uneven
    const uneven = candidateMetrics(
      result({ schedule: { assignments: [assign("a", "09:00", "17:00")], shifts: [] } }),
      roster({ a: null, b: null }),
      40,
    );
    expect(uneven.fairnessStdDev).toBeGreaterThan(0);
  });

  it("sums overtime hours over the weekly threshold", () => {
    // a works 8h + 8h = 16h; threshold 10 → 6h OT
    const m = candidateMetrics(
      result({
        schedule: {
          assignments: [
            assign("a", "09:00", "17:00", { key: "a1" }),
            assign("a", "18:00", "23:00", { key: "a2" }), // 5h
          ],
          shifts: [],
        },
      }),
      roster({ a: null }),
      10,
    );
    expect(m.totalHours).toBe(13);
    expect(m.overtimeHours).toBe(3); // 13 - 10
  });

  it("computes the hours-weighted mean seniority rank (ignoring unranked)", () => {
    const m = candidateMetrics(
      result({
        schedule: {
          assignments: [assign("a", "09:00", "17:00"), assign("b", "09:00", "17:00")],
          shifts: [],
        },
      }),
      roster({ a: 1, b: 3 }),
      40,
    );
    expect(m.meanSeniorityRankByHours).toBe(2); // (1*8 + 3*8) / 16

    const noRanks = candidateMetrics(
      result({ schedule: { assignments: [assign("a", "09:00", "17:00")], shifts: [] } }),
      roster({ a: null }),
      40,
    );
    expect(noRanks.meanSeniorityRankByHours).toBeNull();
  });

  it("excludes open shifts (null employee) from hours and counts escalations", () => {
    const m = candidateMetrics(
      result({
        schedule: {
          assignments: [assign("a", "09:00", "17:00"), assign(null, "09:00", "17:00")],
          shifts: [],
        },
        escalations: [
          {
            kind: "propose_overtime",
            slotId: "s1",
            date: DAY,
            roleId: null,
            missing: 1,
            reason: "x",
            employeeIds: [],
            draftMessage: "",
          },
        ],
      }),
      roster({ a: null }),
      40,
    );
    expect(m.totalHours).toBe(8); // open shift excluded
    expect(m.escalations).toBe(1);
  });
});
