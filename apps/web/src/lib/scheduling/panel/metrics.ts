/**
 * Day 49 — pure candidate metrics.
 *
 * Derives the comparable statistics the judge reasons over from an optimize-loop
 * {@link OptimizeResult}, a minimal roster (seniority), and the weekly overtime
 * threshold. No I/O, no `server-only`. Hours come from the candidate's assignments
 * via the Day-42 {@link shiftHours} (period-level totals, matching the solver's v1
 * per-period hour model).
 */

import { shiftHours } from "../labor-rules";
import type { OptimizeResult } from "../orchestrator/types";
import type { CandidateMetrics } from "./types";

export type MetricsRosterEntry = { id: string; seniorityRank: number | null };

function stdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function candidateMetrics(
  result: OptimizeResult,
  roster: MetricsRosterEntry[],
  overtimeThresholdWeekly: number,
): CandidateMetrics {
  const totalRequired = result.gapReport.reduce((s, g) => s + g.required, 0);
  const totalFilled = result.gapReport.reduce((s, g) => s + g.filled, 0);
  const totalMissing = result.gapReport.reduce((s, g) => s + Math.max(0, g.missing), 0);
  const coverageRatio = totalRequired === 0 ? 1 : totalFilled / totalRequired;
  const solverScore = result.trace.length ? result.trace[result.trace.length - 1].score : 0;

  // Per-employee assigned hours (open shifts have no employee → excluded).
  const hoursByEmp = new Map<string, number>();
  for (const a of result.schedule.assignments) {
    if (!a.employeeId) continue;
    const h = shiftHours({
      employeeId: a.employeeId,
      startsAt: a.startsAt,
      endsAt: a.endsAt,
      breakMinutes: a.breakMinutes,
    });
    hoursByEmp.set(a.employeeId, (hoursByEmp.get(a.employeeId) ?? 0) + h);
  }

  const totalHours = [...hoursByEmp.values()].reduce((s, h) => s + h, 0);

  // Fairness: std-dev across the WHOLE roster (non-working employees count as 0h).
  const rosterHours = roster.map((e) => hoursByEmp.get(e.id) ?? 0);
  const fairnessStdDev = round2(stdDev(rosterHours));

  const overtimeHours = round2(
    [...hoursByEmp.values()].reduce((s, h) => s + Math.max(0, h - overtimeThresholdWeekly), 0),
  );

  // Hours-weighted mean seniority rank (lower = senior staff got the hours).
  const rankById = new Map(roster.map((e) => [e.id, e.seniorityRank]));
  let weightedRank = 0;
  let rankedHours = 0;
  for (const [empId, h] of hoursByEmp) {
    const rank = rankById.get(empId);
    if (rank === null || rank === undefined) continue;
    weightedRank += rank * h;
    rankedHours += h;
  }
  const meanSeniorityRankByHours = rankedHours > 0 ? round2(weightedRank / rankedHours) : null;

  return {
    totalRequired,
    totalFilled,
    totalMissing,
    coverageRatio: round2(coverageRatio),
    covered: result.covered,
    solverScore,
    totalHours: round2(totalHours),
    fairnessStdDev,
    overtimeHours,
    meanSeniorityRankByHours,
    escalations: result.escalations.length,
  };
}
