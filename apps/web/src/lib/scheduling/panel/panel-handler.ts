import "server-only";

/**
 * Day 49 — server-only wiring for the candidate panel.
 *
 * Runs the Day-48 optimize-loop once per weighting profile (deterministically —
 * `useLlm:false`), self-checks each candidate's legality, runs the pure
 * `runCandidatePanel` with the DeepSeek judge, then PERSISTS the winner as a draft
 * `schedules` row + `shifts` and every candidate as a `schedule_versions` row.
 *
 * Client posture (mirrors Day 48): schedules/shifts/versions are written through the
 * user-session manager client (RLS manager-write gates them); the
 * `scheduling_audit_log` trail is written through the service-role admin client
 * (that table is service-role/RPC-write only). Reads (roster, labor rules) use the
 * user-session client. Nothing is published — drafts only.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { recordUsage } from "@/lib/billing/usage";
import { chatCompletion } from "@/lib/deepseek/client";
import { SCHEDULING_MODEL_PRO } from "@/lib/deepseek/models";
import { mapDeepSeekUsage } from "@/lib/deepseek/usage";
import { logger } from "@/lib/observability/logger";

import { optimizeSchedule } from "../orchestrator/orchestrate-handler";
import type { AgentInputs } from "../orchestrator/types";
import { getLaborRules } from "../queries";
import { validateLaborRules } from "../labor-rules";
import type { EmployeeContext, ShiftInput } from "../types";

import { CANDIDATE_PROFILES } from "./profiles";
import { candidateMetrics, type MetricsRosterEntry } from "./metrics";
import { judgeCandidates } from "./judge";
import { runCandidatePanel } from "./panel";
import type { Candidate, CandidateSummary, PanelResult } from "./types";

export type RunPanelInput = {
  orgId: string;
  userId: string;
  periodStart: string;
  periodEnd: string;
  agentInputs?: AgentInputs;
};

type RosterRow = { id: string; is_minor: boolean; seniority_rank: number | null };

/** Map a candidate's assignments to ShiftInput for the labor-rules self-check. */
function assignmentsToShifts(
  assignments: Candidate["result"]["schedule"]["assignments"],
): ShiftInput[] {
  return assignments.map((a) => ({
    id: a.key,
    employeeId: a.employeeId,
    startsAt: a.startsAt,
    endsAt: a.endsAt,
    breakMinutes: a.breakMinutes,
  }));
}

export async function runSchedulePanelHandler(input: RunPanelInput): Promise<PanelResult> {
  const admin = createAdminClient();
  const supabase = await createClient();

  // Roster + labor rules for metrics + the legality self-check.
  const [{ data: rosterData }, laborRules] = await Promise.all([
    supabase
      .from("employees")
      .select("id, is_minor, seniority_rank")
      .eq("org_id", input.orgId)
      .eq("active", true),
    getLaborRules(input.orgId),
  ]);
  const roster = (rosterData ?? []) as RosterRow[];
  const metricsRoster: MetricsRosterEntry[] = roster.map((e) => ({
    id: e.id,
    seniorityRank: e.seniority_rank,
  }));
  const employeeContexts: EmployeeContext[] = roster.map((e) => ({
    id: e.id,
    isMinor: e.is_minor,
  }));

  // 1. Generate one candidate per weighting profile (deterministic — no LLM).
  const candidates: Candidate[] = [];
  for (const profile of CANDIDATE_PROFILES) {
    const result = await optimizeSchedule({
      orgId: input.orgId,
      userId: input.userId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      agentInputs: { ...input.agentInputs, weights: profile.weights },
      useLlm: false,
    });
    const hardViolations = validateLaborRules(
      assignmentsToShifts(result.schedule.assignments),
      laborRules,
      employeeContexts,
    ).filter((v) => v.severity === "hard");
    candidates.push({ label: profile.label, weights: profile.weights, result, hardViolations });
  }

  // 2. Judge (the only LLM call) + select.
  const outcome = await runCandidatePanel(candidates, {
    metricsOf: (c) =>
      candidateMetrics(c.result, metricsRoster, laborRules.overtime_threshold_weekly),
    judge: (cands) =>
      judgeCandidates(cands, {
        chat: chatCompletion,
        model: SCHEDULING_MODEL_PRO,
        onUsage: (model, usage) =>
          recordUsage(input.orgId, input.userId, model, mapDeepSeekUsage(usage)),
      }),
  });

  // 3. Persist the winner (schedules + shifts) + all versions.
  const scheduleId = await persist(supabase, admin, input, outcome);

  const versions: CandidateSummary[] = outcome.ranked.map((r) => ({
    label: r.candidate.label,
    weights: r.candidate.weights,
    metrics: r.metrics,
    covered: r.metrics.covered,
    totalMissing: r.metrics.totalMissing,
    judgeRank: r.judgeRank,
    isSelected: r.isSelected,
  }));

  return {
    scheduleId,
    selectedLabel: outcome.selected.label,
    selected: outcome.selected.result,
    versions,
    judge: outcome.judge,
    summary: outcome.judge.rationale,
  };
}

/** Write schedules + shifts + schedule_versions; returns the schedule id (null on failure). */
async function persist(
  supabase: SupabaseClient,
  admin: SupabaseClient,
  input: RunPanelInput,
  outcome: Awaited<ReturnType<typeof runCandidatePanel>>,
): Promise<string | null> {
  const { selected, ranked, judge } = outcome;

  const { data: sched, error: schedErr } = await supabase
    .from("schedules")
    .insert({
      org_id: input.orgId,
      name: `Schedule ${input.periodStart} – ${input.periodEnd}`,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      status: "draft",
      created_by: input.userId,
      optimization_summary: judge.rationale,
    })
    .select("id")
    .single();

  if (schedErr || !sched) {
    logger.error("runSchedulePanel: schedule insert failed", { err: schedErr, orgId: input.orgId });
    return null;
  }
  const scheduleId = sched.id as string;

  // Winner's shifts (open shifts kept; employee_id null → status 'open').
  const shiftRows = selected.result.schedule.assignments.map((a) => ({
    org_id: input.orgId,
    schedule_id: scheduleId,
    employee_id: a.employeeId,
    role_certification_id: a.roleId,
    starts_at: a.startsAt,
    ends_at: a.endsAt,
    break_minutes: a.breakMinutes,
    status: a.employeeId ? "draft" : "open",
  }));
  if (shiftRows.length > 0) {
    const { error: shiftErr } = await supabase.from("shifts").insert(shiftRows);
    if (shiftErr)
      logger.error("runSchedulePanel: shifts insert failed", { err: shiftErr, scheduleId });
  }

  // Every candidate as a version.
  const versionRows = ranked.map((r) => ({
    org_id: input.orgId,
    schedule_id: scheduleId,
    label: r.candidate.label,
    weights: r.candidate.weights,
    assignments: r.candidate.result.schedule.assignments,
    score: r.metrics,
    gap_report: r.candidate.result.gapReport,
    covered: r.metrics.covered,
    total_missing: r.metrics.totalMissing,
    judge_rank: r.judgeRank,
    is_selected: r.isSelected,
  }));
  const { error: versionErr } = await supabase.from("schedule_versions").insert(versionRows);
  if (versionErr)
    logger.error("runSchedulePanel: versions insert failed", { err: versionErr, scheduleId });

  // Audit trail (service-role; scheduling_audit_log is write-restricted).
  await admin.from("scheduling_audit_log").insert([
    {
      org_id: input.orgId,
      actor_type: "manager",
      actor_id: input.userId,
      action: "schedule.created",
      entity_type: "schedule",
      entity_id: scheduleId,
      detail: {
        period_start: input.periodStart,
        period_end: input.periodEnd,
        selected_label: selected.label,
      },
    },
    {
      org_id: input.orgId,
      actor_type: "agent",
      actor_id: null,
      action: "candidate_panel.judged",
      entity_type: "schedule",
      entity_id: scheduleId,
      detail: { winner: judge.winnerLabel, ranking: judge.ranking, candidates: ranked.length },
    },
  ]);

  return scheduleId;
}
