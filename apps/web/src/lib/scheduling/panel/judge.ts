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
  return {
    winnerLabel: ranking[0],
    ranking,
    rationale:
      "Selected by the deterministic tie-break: most coverage, then lowest solver score, then profile order.",
  };
}

function buildSystemPrompt(): string {
  return [
    "You are the judge in a staff-scheduling candidate panel. Several schedules were",
    "generated under different objective weightings; EVERY candidate is already legal",
    "(no labor-rule violations). Choose the single best schedule on the soft / human",
    "trade-offs and explain why in 2-4 plain sentences a small-business manager would",
    "understand.",
    "",
    "Priorities, in order: (1) coverage — fewer unfilled shifts (totalMissing) is",
    "better; (2) then the human trade-offs — fairness (lower fairnessStdDev is fairer),",
    "overtime/cost (lower overtimeHours is cheaper), seniority (lower",
    "meanSeniorityRankByHours means senior staff got the hours). Use solverScore",
    "(lower = better) only to break near-ties.",
    "",
    "Rank EVERY candidate exactly once using its label. winnerLabel must be one of the",
    "provided labels and must be ranking[0].",
  ].join("\n");
}

function buildUserContent(candidates: JudgeCandidateInput[]): string {
  return [
    "Candidates (label → metrics):",
    JSON.stringify(candidates, null, 2),
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

  let data: z.infer<typeof verdictSchema>;
  try {
    ({ data } = await generateStructuredDeepSeek({
      chat: deps.chat,
      schema: verdictSchema,
      system: buildSystemPrompt(),
      userContent: buildUserContent(candidates),
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
