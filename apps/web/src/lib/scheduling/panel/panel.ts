/**
 * Day 49 — the pure candidate-panel orchestration.
 *
 * No `server-only`: candidate generation (the Day-48 loop), metrics derivation, and
 * the judge are all injected, so this is unit-testable with fakes. It applies the
 * hard-constraint filter (drop any candidate with labor violations — expected none,
 * since the solver is correct by construction), asks the judge to rank the legal
 * pool, and marks the selected candidate. Deterministic given a stubbed judge.
 */

import type { JudgeCandidateInput } from "./judge";
import type {
  Candidate,
  CandidateMetrics,
  JudgeVerdict,
  PanelOutcome,
  RankedCandidate,
} from "./types";

export type RunCandidatePanelDeps = {
  /** Derive comparable metrics for a candidate (handler injects roster + threshold). */
  metricsOf: (candidate: Candidate) => CandidateMetrics;
  /** Rank the legal pool + pick a winner (DeepSeek judge, or a fake in tests). */
  judge: (candidates: JudgeCandidateInput[]) => Promise<JudgeVerdict>;
};

export async function runCandidatePanel(
  candidates: Candidate[],
  deps: RunCandidatePanelDeps,
): Promise<PanelOutcome> {
  if (candidates.length === 0) throw new Error("runCandidatePanel: no candidates to judge");

  // Metrics for every candidate (kept for the record, even filtered ones).
  const metricsByLabel = new Map<string, CandidateMetrics>(
    candidates.map((c) => [c.label, deps.metricsOf(c)]),
  );

  // Hard-constraint filter: only legal candidates are judged. (Safety net — the
  // solver never emits a hard violation, but never persist one if it somehow does.)
  const legal = candidates.filter((c) => c.hardViolations.length === 0);
  const pool = legal.length > 0 ? legal : candidates;

  const verdict = await deps.judge(
    pool.map((c) => ({ label: c.label, metrics: metricsByLabel.get(c.label)! })),
  );

  const rankByLabel = new Map(verdict.ranking.map((label, i) => [label, i + 1]));
  const winner = candidates.find((c) => c.label === verdict.winnerLabel) ?? pool[0];

  const ranked: RankedCandidate[] = candidates.map((c) => ({
    candidate: c,
    metrics: metricsByLabel.get(c.label)!,
    judgeRank: rankByLabel.get(c.label) ?? null,
    isSelected: c.label === winner.label,
  }));

  return { selected: winner, ranked, judge: verdict };
}
