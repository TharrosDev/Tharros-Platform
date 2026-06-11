/**
 * Letter grades for panel candidates — the manager-facing replacement for raw
 * solver scores in the judge's rationale. The solver score is an unbounded
 * penalty sum (lower = better) whose magnitude means nothing to a reader
 * (756.53 vs 12006.53), so candidates are graded RELATIVE to the best of the
 * pool, with an absolute hard-cap when shifts are left uncovered.
 *
 * Pure + deterministic: same pool in, same grades out.
 */

import type { CandidateLabel, CandidateMetrics } from "./types";

export type LetterGrade = "A+" | "A" | "A-" | "B+" | "B" | "B-" | "C+" | "C" | "D" | "F";

/** Best → worst. */
export const GRADE_LADDER: readonly LetterGrade[] = [
  "A+",
  "A",
  "A-",
  "B+",
  "B",
  "B-",
  "C+",
  "C",
  "D",
  "F",
] as const;

/**
 * Relative-excess thresholds: `r = (score - bestScore) / max(bestScore, RATIO_FLOOR)`
 * maps to the first grade whose bound it does not exceed. The floor keeps a tiny
 * baseline from exploding the ratio and sits well below one coverage gap
 * (`coverageGapPenalty = 1000` in `solver/types.ts` `DEFAULT_SOLVER_WEIGHTS`),
 * so a candidate one full gap behind the best always lands several steps down.
 */
const RATIO_FLOOR = 100;
const RATIO_BOUNDS: readonly { max: number; grade: LetterGrade }[] = [
  { max: 0.02, grade: "A+" },
  { max: 0.1, grade: "A" },
  { max: 0.25, grade: "A-" },
  { max: 0.5, grade: "B+" },
  { max: 1, grade: "B" },
  { max: 2, grade: "B-" },
  { max: 4, grade: "C+" },
  { max: 8, grade: "C" },
  { max: 16, grade: "D" },
] as const;

/** The worse (further down the ladder) of two grades. */
export function minGrade(a: LetterGrade, b: LetterGrade): LetterGrade {
  return GRADE_LADDER.indexOf(a) >= GRADE_LADDER.indexOf(b) ? a : b;
}

/** Absolute cap from coverage: leaving shifts unfilled bounds the grade no matter the pool. */
function coverageCap(m: CandidateMetrics): LetterGrade {
  if (m.coverageRatio < 0.5) return "F";
  if (m.totalMissing >= 4 || m.coverageRatio < 0.8) return "D";
  if (m.totalMissing >= 2) return "C";
  if (m.totalMissing === 1) return "B";
  return "A+"; // fully covered — no cap
}

export type GradedCandidate = { label: CandidateLabel; metrics: CandidateMetrics };

/** Grade every candidate relative to the pool's best solver score, coverage-capped. */
export function gradeCandidates(
  candidates: readonly GradedCandidate[],
): Map<CandidateLabel, LetterGrade> {
  const grades = new Map<CandidateLabel, LetterGrade>();
  if (candidates.length === 0) return grades;
  const baseline = Math.min(...candidates.map((c) => c.metrics.solverScore));
  for (const { label, metrics } of candidates) {
    const r = (metrics.solverScore - baseline) / Math.max(baseline, RATIO_FLOOR);
    const relative = RATIO_BOUNDS.find((b) => r <= b.max)?.grade ?? "F";
    grades.set(label, minGrade(relative, coverageCap(metrics)));
  }
  return grades;
}

/**
 * True when the pool offers no real trade-off to talk about: identical coverage
 * and every grade within one ladder step of the best. Drives the judge's
 * "keep it to 1-2 sentences" instruction.
 */
export function nearIdentical(
  candidates: readonly GradedCandidate[],
  grades: Map<CandidateLabel, LetterGrade>,
): boolean {
  if (candidates.length <= 1) return true;
  const missing = new Set(candidates.map((c) => c.metrics.totalMissing));
  if (missing.size > 1) return false;
  const indices = candidates.map((c) => GRADE_LADDER.indexOf(grades.get(c.label) ?? "F"));
  return Math.max(...indices) - Math.min(...indices) <= 1;
}
