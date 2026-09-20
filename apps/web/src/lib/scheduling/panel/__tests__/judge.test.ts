import { describe, expect, it, vi } from "vitest";

import type { DeepSeekChat, DeepSeekChatResponse } from "@/lib/deepseek/structured";

import { judgeCandidates, type JudgeCandidateInput } from "../judge";
import type { CandidateMetrics } from "../types";

/**
 * Day 49 — candidate-panel judge. Provider-free: the DeepSeek chat fn is injected.
 * Covers the happy path, ranking sanitation, and the deterministic fallback when the
 * model errors or returns an invalid winner.
 */

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

const CANDS: JudgeCandidateInput[] = [
  { label: "balanced", metrics: metrics({ totalMissing: 2, solverScore: 300 }) },
  { label: "fairness", metrics: metrics({ totalMissing: 0, solverScore: 120, fairnessStdDev: 1 }) },
  { label: "seniority", metrics: metrics({ totalMissing: 0, solverScore: 150 }) },
];

function toolCall(args: unknown): DeepSeekChatResponse {
  return {
    model: "deepseek-v4-pro",
    choices: [
      {
        message: {
          content: null,
          tool_calls: [
            {
              id: "c1",
              type: "function",
              function: { name: "record_judge_verdict", arguments: JSON.stringify(args) },
            },
          ],
        },
      },
    ],
    usage: { prompt_tokens: 200, completion_tokens: 60 },
  };
}

describe("judgeCandidates", () => {
  it("uses the model's winner and rationale on a valid verdict", async () => {
    const chat: DeepSeekChat = vi.fn(async () =>
      toolCall({
        winnerLabel: "fairness",
        ranking: ["fairness", "seniority", "balanced"],
        rationale: "Best coverage, fairest.",
      }),
    );
    const v = await judgeCandidates(CANDS, { chat });
    expect(v.winnerLabel).toBe("fairness");
    expect(v.ranking[0]).toBe("fairness");
    expect(v.ranking).toEqual(["fairness", "seniority", "balanced"]);
    expect(v.rationale).toContain("fairest");
  });

  it("appends any labels the model omitted from the ranking", async () => {
    const chat: DeepSeekChat = vi.fn(async () =>
      toolCall({ winnerLabel: "seniority", ranking: ["seniority"], rationale: "x" }),
    );
    const v = await judgeCandidates(CANDS, { chat });
    expect(v.winnerLabel).toBe("seniority");
    expect(new Set(v.ranking)).toEqual(new Set(["balanced", "fairness", "seniority"]));
    expect(v.ranking[0]).toBe("seniority");
  });

  it("falls back deterministically when the winner is not a provided label", async () => {
    const chat: DeepSeekChat = vi.fn(async () =>
      toolCall({ winnerLabel: "made_up", ranking: ["made_up"], rationale: "x" }),
    );
    const v = await judgeCandidates(CANDS, { chat });
    // Deterministic: least totalMissing → lowest solverScore → fairness wins.
    expect(v.winnerLabel).toBe("fairness");
    expect(v.ranking[0]).toBe("fairness");
  });

  it("falls back deterministically when the model call throws", async () => {
    const chat: DeepSeekChat = vi.fn(async () => {
      throw new Error("network");
    });
    const v = await judgeCandidates(CANDS, { chat });
    expect(v.winnerLabel).toBe("fairness");
    expect(v.rationale).toMatch(/tie-break/i);
    // Grade-based, never the raw solver score.
    expect(v.rationale).toMatch(/grade [A-F][+-]?/);
    expect(v.rationale).not.toMatch(/\d{3,}/);
  });

  it("sends letter grades to the model and never the raw solver score", async () => {
    const chat = vi.fn(async () =>
      toolCall({
        winnerLabel: "fairness",
        ranking: ["fairness", "seniority", "balanced"],
        rationale: "x",
      }),
    );
    await judgeCandidates(CANDS, { chat });
    const payload = JSON.stringify(chat.mock.calls[0]);
    expect(payload).not.toContain("solverScore");
    expect(payload).toMatch(/\\"grade\\": \\"A\+\\"/); // per-candidate grade in the user content
    expect(payload).toMatch(/letter grade/i);
  });

  it("does not call the model when there is a single candidate", async () => {
    const chat: DeepSeekChat = vi.fn(async () => toolCall({}));
    const v = await judgeCandidates([CANDS[0]], { chat });
    expect(chat).not.toHaveBeenCalled();
    expect(v.winnerLabel).toBe("balanced");
  });
});
