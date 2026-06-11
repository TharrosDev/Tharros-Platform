import { describe, expect, it } from "vitest";

import { GRADE_LADDER, gradeCandidates, minGrade, nearIdentical } from "../grade";
import type { CandidateMetrics } from "../types";

/** Letter grades for candidates — pure and deterministic, relative to the pool's best. */

function metrics(over: Partial<CandidateMetrics> = {}): CandidateMetrics {
  return {
    totalRequired: 10,
    totalFilled: 10,
    totalMissing: 0,
    coverageRatio: 1,
    covered: true,
    solverScore: 100,
    totalHours: 80,
    fairnessStdDev: 2,
    overtimeHours: 0,
    meanSeniorityRankByHours: null,
    escalations: 0,
    ...over,
  };
}

describe("gradeCandidates", () => {
  it("always grades the fully-covered best candidate A+", () => {
    const grades = gradeCandidates([
      { label: "balanced", metrics: metrics({ solverScore: 756.53 }) },
      { label: "cost", metrics: metrics({ solverScore: 756.53 }) },
    ]);
    expect(grades.get("balanced")).toBe("A+");
    expect(grades.get("cost")).toBe("A+");
  });

  it("steps grades down with relative distance from the best", () => {
    const grades = gradeCandidates([
      { label: "balanced", metrics: metrics({ solverScore: 756.53 }) },
      { label: "fairness", metrics: metrics({ solverScore: 802.24 }) },
      { label: "seniority", metrics: metrics({ solverScore: 12006.53 }) },
    ]);
    // 802.24 is ~6% over the baseline → A; 12006.53 is ~15x over → D.
    expect(grades.get("balanced")).toBe("A+");
    expect(grades.get("fairness")).toBe("A");
    expect(grades.get("seniority")).toBe("D");
  });

  it("uses the ratio floor so tiny baselines do not explode the ratio", () => {
    const grades = gradeCandidates([
      { label: "balanced", metrics: metrics({ solverScore: 1 }) },
      { label: "cost", metrics: metrics({ solverScore: 6 }) },
    ]);
    // (6 - 1) / max(1, 100) = 0.05 → A, not several letters down.
    expect(grades.get("cost")).toBe("A");
  });

  it("caps the grade when shifts are left uncovered, even for the pool's best", () => {
    const grades = gradeCandidates([
      {
        label: "balanced",
        metrics: metrics({ totalMissing: 1, totalFilled: 9, coverageRatio: 0.9, covered: false }),
      },
      {
        label: "cost",
        metrics: metrics({
          totalMissing: 3,
          totalFilled: 7,
          coverageRatio: 0.7,
          covered: false,
          solverScore: 110,
        }),
      },
      {
        label: "seniority",
        metrics: metrics({
          totalMissing: 6,
          totalFilled: 4,
          coverageRatio: 0.4,
          covered: false,
          solverScore: 120,
        }),
      },
    ]);
    // All three score within a step of each other — only the coverage cap separates them.
    expect(grades.get("balanced")).toBe("B"); // best of pool, but 1 missing caps at B
    expect(grades.get("cost")).toBe("D"); // coverageRatio < 0.8
    expect(grades.get("seniority")).toBe("F"); // coverageRatio < 0.5
  });

  it("is deterministic and handles an empty pool", () => {
    const pool = [
      { label: "balanced" as const, metrics: metrics() },
      { label: "fairness" as const, metrics: metrics({ solverScore: 500 }) },
    ];
    expect(gradeCandidates(pool)).toEqual(gradeCandidates(pool));
    expect(gradeCandidates([]).size).toBe(0);
  });
});

describe("minGrade", () => {
  it("returns the worse of two grades", () => {
    expect(minGrade("A+", "B")).toBe("B");
    expect(minGrade("D", "A")).toBe("D");
    expect(minGrade("C", "C")).toBe("C");
    // Ladder covers every grade exactly once, best first.
    expect(GRADE_LADDER[0]).toBe("A+");
    expect(GRADE_LADDER[GRADE_LADDER.length - 1]).toBe("F");
  });
});

describe("nearIdentical", () => {
  it("is true when coverage matches and grades sit within one step", () => {
    const pool = [
      { label: "balanced" as const, metrics: metrics({ solverScore: 756 }) },
      { label: "cost" as const, metrics: metrics({ solverScore: 760 }) },
      { label: "fairness" as const, metrics: metrics({ solverScore: 802 }) },
    ];
    expect(nearIdentical(pool, gradeCandidates(pool))).toBe(true);
  });

  it("is false when a candidate trails by more than one grade step", () => {
    const pool = [
      { label: "balanced" as const, metrics: metrics({ solverScore: 756 }) },
      { label: "seniority" as const, metrics: metrics({ solverScore: 12006 }) },
    ];
    expect(nearIdentical(pool, gradeCandidates(pool))).toBe(false);
  });

  it("is false when coverage differs", () => {
    const pool = [
      { label: "balanced" as const, metrics: metrics() },
      {
        label: "cost" as const,
        metrics: metrics({ totalMissing: 1, totalFilled: 9, coverageRatio: 0.9, covered: false }),
      },
    ];
    expect(nearIdentical(pool, gradeCandidates(pool))).toBe(false);
  });
});
