/**
 * Day 49 — the candidate-panel judge.
 *
 * A single holistic DeepSeek `v4-pro` call ranks every (legal) candidate on the
 * soft/human trade-offs, picks the winner, and explains the choice. Pure +
 * provider-free (the `chat` seam is injected, mirroring `intent.ts`); the
 * server-only handler passes the real client + usage meter.
 *
 * The judge cannot widen the choice set — it only orders the candidates it is
 * given (all guaranteed-legal). A model error, an unparseable response, or a
 * winner outside the provided labels falls back to a DETERMINISTIC ranking (most
 * coverage → lowest solver score → profile order), so the panel always returns a
 * stable verdict and committed tests stay provider-free.
 */

import { z } from "zod";

import {
  generateStructuredDeepSeek,
  type DeepSeekChat,
  type DeepSeekUsage,
} from "@/lib/deepseek/structured";
import { SCHEDULING_MODEL_PRO } from "@/lib/deepseek/models";
import { gradeCandidates, nearIdentical, type LetterGrade } from "./grade";
import type { CandidateLabel, CandidateMetrics, JudgeVerdict } from "./types";

export type JudgeCandidateInput = { label: CandidateLabel; metrics: CandidateMetrics };

export type JudgeDeps = {
  chat: DeepSeekChat;
  model?: string;
  maxRetries?: number;
  onUsage?: (model: string, usage: DeepSeekUsage | null) => void | Promise<void>;
};

const verdictSchema = z.object({
  winnerLabel: z.string(),
  ranking: z.array(z.string()),
  rationale: z.string(),
});

/** Deterministic order: most coverage → lowest solver score → input (profile) order. */
function deterministicRanking(candidates: JudgeCandidateInput[]): CandidateLabel[] {
  return candidates
    .map((c, i) => ({ c, i }))
    .sort((a, b) => {
      if (a.c.metrics.totalMissing !== b.c.metrics.totalMissing) {
        return a.c.metrics.totalMissing - b.c.metrics.totalMissing;
      }
      if (a.c.metrics.solverScore !== b.c.metrics.solverScore) {
        return a.c.metrics.solverScore - b.c.metrics.solverScore;
      }
      return a.i - b.i;
    })
    .map((x) => x.c.label);
}

function fallbackVerdict(candidates: JudgeCandidateInput[]): JudgeVerdict {
  const ranking = deterministicRanking(candidates);
  const grades = gradeCandidates(candidates);
  const winnerLabel = ranking[0];
  const grade = winnerLabel ? grades.get(winnerLabel) : undefined;
  return {
    winnerLabel,
    ranking,
    rationale: grade
      ? `Picked the ${winnerLabel} schedule (grade ${grade}) by the deterministic tie-break: best coverage first, then the strongest overall grade.`
      : "Selected by the deterministic tie-break: most coverage, then profile order.",
  };
}

function buildSystemPrompt(simple: boolean): string {
  return [
    "You are the judge in a staff-scheduling candidate panel. Several schedules were",
    "generated under different objective weightings; EVERY candidate is already legal",
    "(no labor-rule violations). Choose the single best schedule on the soft / human",
    "trade-offs and explain why in plain language a small-business manager would",
    "understand.",
    "",
    "Each candidate carries an overall letter grade from the optimizer (A+ is best,",
    "F is worst). Refer to candidates by their grade when comparing quality; NEVER",
    "mention numeric optimizer scores, internal metrics names, or invent numbers.",
    "",
    "Priorities, in order: (1) coverage — fewer unfilled shifts (totalMissing) is",
    "better; (2) then the human trade-offs — fairness (lower fairnessStdDev is fairer),",
    "overtime/cost (lower overtimeHours is cheaper), seniority (lower",
    "meanSeniorityRankByHours means senior staff got the hours). Use the letter grade",
    "to break near-ties.",
    "",
    simple
      ? "These candidates are nearly identical — keep the rationale to 1-2 short sentences; do not manufacture differences."
      : "Keep the rationale to 1-2 sentences when the choice is clear-cut; use 3-4 only when there is a genuine trade-off worth flagging.",
    "",
    "Rank EVERY candidate exactly once using its label. winnerLabel must be one of the",
    "provided labels and must be ranking[0].",
  ].join("\n");
}

/** The judge-facing view of a candidate: letter grade in, raw solver score out. */
function judgeView(c: JudgeCandidateInput, grade: LetterGrade | undefined) {
  const { solverScore: _solverScore, ...metrics } = c.metrics;
  return { label: c.label, grade, metrics };
}

function buildUserContent(
  candidates: JudgeCandidateInput[],
  grades: Map<CandidateLabel, LetterGrade>,
): string {
  return [
    "Candidates (label → grade + metrics):",
    JSON.stringify(
      candidates.map((c) => judgeView(c, grades.get(c.label))),
      null,
      2,
    ),
    "",
    `Valid labels: ${candidates.map((c) => c.label).join(", ")}.`,
  ].join("\n");
}

/**
 * Judge the candidates. Always returns a verdict whose winner + ranking reference
 * only the provided labels (falls back deterministically on any model issue).
 */
export async function judgeCandidates(
  candidates: JudgeCandidateInput[],
  deps: JudgeDeps,
): Promise<JudgeVerdict> {
  if (candidates.length <= 1) return fallbackVerdict(candidates);

  const labels = new Set<string>(candidates.map((c) => c.label));
  const grades = gradeCandidates(candidates);

  let data: z.infer<typeof verdictSchema>;
  try {
    ({ data } = await generateStructuredDeepSeek({
      chat: deps.chat,
      schema: verdictSchema,
      system: buildSystemPrompt(nearIdentical(candidates, grades)),
      userContent: buildUserContent(candidates, grades),
      model: deps.model ?? SCHEDULING_MODEL_PRO,
      toolName: "record_judge_verdict",
      toolDescription: "Record the ranking, winner, and rationale.",
      maxRetries: deps.maxRetries,
      onUsage: deps.onUsage,
    }));
  } catch {
    return fallbackVerdict(candidates);
  }

  // Winner must be a real, provided label.
  if (!labels.has(data.winnerLabel)) return fallbackVerdict(candidates);

  // Sanitize ranking: keep valid labels in the model's order, dedupe, then append
  // any the model omitted (in deterministic order) so every candidate is covered.
  const seen = new Set<string>();
  const ranking: CandidateLabel[] = [];
  for (const label of data.ranking) {
    if (labels.has(label) && !seen.has(label)) {
      seen.add(label);
      ranking.push(label as CandidateLabel);
    }
  }
  for (const label of deterministicRanking(candidates)) {
    if (!seen.has(label)) {
      seen.add(label);
      ranking.push(label);
    }
  }

  // Winner leads the ranking.
  const winnerLabel = data.winnerLabel as CandidateLabel;
  const ordered = [winnerLabel, ...ranking.filter((l) => l !== winnerLabel)];

  return { winnerLabel, ranking: ordered, rationale: data.rationale.trim() || fallbackVerdict(candidates).rationale };
}
