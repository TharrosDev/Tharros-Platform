/**
 * Day 49 — candidate panel + judge: domain types.
 *
 * Pure types only (no `server-only`). The panel runs the Day-48 optimize-loop under
 * each {@link CandidateProfile}, attaches a hard-violation self-check, derives
 * comparable {@link CandidateMetrics}, and a judge picks the winner. The winner is
 * persisted as a draft `schedules` row + `shifts`; every candidate is persisted as a
 * `schedule_versions` row.
 */

import type { OptimizeResult } from "../orchestrator/types";
import type { SolverWeights } from "../solver/types";
import type { Violation } from "../types";
import type { CandidateLabel } from "./profiles";

export type { CandidateLabel } from "./profiles";

/** One generated candidate: the weighting that produced it + the optimize-loop result. */
export type Candidate = {
  label: CandidateLabel;
  weights: SolverWeights;
  result: OptimizeResult;
  /** Self-check (expected empty — the solver is correct by construction). */
  hardViolations: Violation[];
};

/** Comparable, judge-facing statistics derived from a candidate (pure). */
export type CandidateMetrics = {
  totalRequired: number;
  totalFilled: number;
  totalMissing: number;
  /** filled / required (1 when nothing required). */
  coverageRatio: number;
  covered: boolean;
  /** Final-solve soft-objective score (lower = better). */
  solverScore: number;
  totalHours: number;
  /** Std-dev of per-employee assigned hours across the roster (lower = fairer). */
  fairnessStdDev: number;
  /** Sum of hours over the weekly overtime threshold (lower = cheaper). */
  overtimeHours: number;
  /** Hours-weighted mean seniority_rank (lower = senior staff got the hours); null if unknown. */
  meanSeniorityRankByHours: number | null;
  escalations: number;
};

/** The judge's decision over the legal candidate pool. */
export type JudgeVerdict = {
  winnerLabel: CandidateLabel;
  /** Best → worst, covering every judged (legal) candidate exactly once. */
  ranking: CandidateLabel[];
  rationale: string;
};

/** A candidate plus its metrics + judge placement — the unit persisted as a version. */
export type RankedCandidate = {
  candidate: Candidate;
  metrics: CandidateMetrics;
  /** 1 = the judge's pick; null = filtered out (illegal) and not judged. */
  judgeRank: number | null;
  isSelected: boolean;
};

/** The pure panel's output (no persistence). */
export type PanelOutcome = {
  selected: Candidate;
  /** Every candidate (legal + filtered), in profile order. */
  ranked: RankedCandidate[];
  judge: JudgeVerdict;
};

/** A serializable per-candidate summary returned to the caller. */
export type CandidateSummary = {
  label: CandidateLabel;
  weights: SolverWeights;
  metrics: CandidateMetrics;
  covered: boolean;
  totalMissing: number;
  judgeRank: number | null;
  isSelected: boolean;
};

/** The handler's result after persistence. */
export type PanelResult = {
  /** The persisted draft schedule id (null if persistence failed). */
  scheduleId: string | null;
  selectedLabel: CandidateLabel;
  /** The winning optimize-loop result (schedule + residual gaps + escalations). */
  selected: OptimizeResult;
  versions: CandidateSummary[];
  judge: JudgeVerdict;
  /** Judge rationale (also stored on schedules.optimization_summary). */
  summary: string;
};
