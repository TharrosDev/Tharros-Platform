import { describe, expect, it, vi } from "vitest";

import { runCandidatePanel } from "../panel";
import type { JudgeCandidateInput } from "../judge";
import type { Candidate, CandidateMetrics, JudgeVerdict, CandidateLabel } from "../types";
import type { OptimizeResult } from "../../orchestrator/types";
import type { Violation } from "../../types";
import { DEFAULT_SOLVER_WEIGHTS } from "../../solver/types";

const stubResult: OptimizeResult = {
  threadId: null,
  schedule: { assignments: [], shifts: [] },
  gapReport: [],
  covered: true,
  trace: [{ round: 0, remedy: null, score: 0, totalMissing: 0 }],
  escalations: [],
  summary: "",
};

const HARD: Violation = { rule: "max_weekly_hours", severity: "hard", message: "over cap" };

function cand(label: CandidateLabel, hardViolations: Violation[] = []): Candidate {
  return { label, weights: { ...DEFAULT_SOLVER_WEIGHTS }, result: stubResult, hardViolations };
}

const metricsOf = (): CandidateMetrics => ({
  totalRequired: 0,
  totalFilled: 0,
  totalMissing: 0,
  coverageRatio: 1,
  covered: true,
  solverScore: 0,
  totalHours: 0,
  fairnessStdDev: 0,
  overtimeHours: 0,
  meanSeniorityRankByHours: null,
  escalations: 0,
});

/** A fake judge that records what it saw and picks a chosen label. */
function fakeJudge(winner: CandidateLabel) {
  const seen: CandidateLabel[][] = [];
  const fn = vi.fn(async (cands: JudgeCandidateInput[]): Promise<JudgeVerdict> => {
    const labels = cands.map((c) => c.label);
    seen.push(labels);
    const ranking = [winner, ...labels.filter((l) => l !== winner)];
    return { winnerLabel: winner, ranking, rationale: "fake" };
  });
  return { fn, seen };
}

describe("runCandidatePanel", () => {
  it("excludes candidates with hard violations from judging", async () => {
    const judge = fakeJudge("balanced");
    const out = await runCandidatePanel(
      [cand("balanced"), cand("fairness", [HARD]), cand("seniority")],
      { metricsOf, judge: judge.fn },
    );

    // The judge only saw the two legal candidates.
    expect(judge.seen[0].sort()).toEqual(["balanced", "seniority"]);

    const fairness = out.ranked.find((r) => r.candidate.label === "fairness")!;
    expect(fairness.judgeRank).toBeNull();
    expect(fairness.isSelected).toBe(false);
    expect(out.selected.label).toBe("balanced");
  });

  it("honors the judge's winner and ranking", async () => {
    const judge = fakeJudge("seniority");
    const out = await runCandidatePanel([cand("balanced"), cand("seniority")], {
      metricsOf,
      judge: judge.fn,
    });

    expect(out.selected.label).toBe("seniority");
    const byLabel = new Map(out.ranked.map((r) => [r.candidate.label, r]));
    expect(byLabel.get("seniority")).toMatchObject({ judgeRank: 1, isSelected: true });
    expect(byLabel.get("balanced")).toMatchObject({ judgeRank: 2, isSelected: false });
  });

  it("computes metrics for every candidate, including filtered ones", async () => {
    const spy = vi.fn(metricsOf);
    const judge = fakeJudge("balanced");
    const out = await runCandidatePanel([cand("balanced"), cand("fairness", [HARD])], {
      metricsOf: spy,
      judge: judge.fn,
    });
    expect(spy).toHaveBeenCalledTimes(2);
    expect(out.ranked).toHaveLength(2);
  });

  it("throws when there are no candidates", async () => {
    const judge = fakeJudge("balanced");
    await expect(runCandidatePanel([], { metricsOf, judge: judge.fn })).rejects.toThrow();
  });
});
