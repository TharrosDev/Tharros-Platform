/**
 * Day 49 — candidate-panel weighting profiles.
 *
 * Pure constants (no `server-only`). Each profile is a complete {@link SolverWeights}
 * (defaults + the axis it emphasizes) the candidate panel runs the Day-48
 * optimize-loop under. The judge then compares the resulting candidates. There is
 * no wage data on employees, so the "cost" lens is modeled as overtime-avoidance
 * (high `laborSoft`, lower `hourTarget`).
 */

import { DEFAULT_SOLVER_WEIGHTS, type SolverWeights } from "../solver/types";

export type CandidateLabel = "balanced" | "fairness" | "seniority" | "cost";

export type CandidateProfile = {
  label: CandidateLabel;
  description: string;
  weights: SolverWeights;
};

export const CANDIDATE_PROFILES: CandidateProfile[] = [
  {
    label: "balanced",
    description: "Neutral baseline — the default solver weights.",
    weights: { ...DEFAULT_SOLVER_WEIGHTS },
  },
  {
    label: "fairness",
    description: "Spread hours as evenly as possible across the team.",
    weights: { ...DEFAULT_SOLVER_WEIGHTS, fairness: 4 },
  },
  {
    label: "seniority",
    description: "Favor more-senior employees for hours.",
    weights: { ...DEFAULT_SOLVER_WEIGHTS, seniority: 4 },
  },
  {
    label: "cost",
    description: "Minimize overtime / premium hours (cost proxy — no wage data).",
    weights: { ...DEFAULT_SOLVER_WEIGHTS, laborSoft: 200, hourTarget: 0.5 },
  },
];

export const CANDIDATE_LABELS: CandidateLabel[] = CANDIDATE_PROFILES.map((p) => p.label);
