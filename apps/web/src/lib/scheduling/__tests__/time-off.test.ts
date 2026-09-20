import { describe, expect, it, vi } from "vitest";

import type { DeepSeekChat, DeepSeekChatResponse } from "@/lib/deepseek/structured";

import {
  classifyImpact,
  deterministicEvaluation,
  evaluateTimeOff,
  rangeLabel,
  resolveTimeOffPolicy,
  timeOffThreadTitle,
  type EvaluateTimeOffArgs,
  type ShiftConflict,
} from "../time-off";

/**
 * Day 57 — time-off policy + impact classification + recommendation helpers.
 * Provider-free: the DeepSeek chat fn is injected, so these exercise the real prompt
 * assembly + schema validation against a fake tool call (no network, no key). The DB
 * orchestration (`processTimeOffRequest` / approve / deny) is covered by the live
 * `time-off.db.test.ts` harness.
 */

function conflict(eligibleCount: number, i = 0): ShiftConflict {
  return {
    shiftId: `s${i}`,
    startsAt: `2026-06-1${i}T09:00:00Z`,
    endsAt: `2026-06-1${i}T17:00:00Z`,
    eligibleCount,
  };
}

function toolCall(args: unknown, model = "deepseek-v4-flash"): DeepSeekChatResponse {
  return {
    model,
    choices: [
      {
        message: {
          content: null,
          tool_calls: [
            {
              id: "c1",
              type: "function",
              function: { name: "record_time_off_evaluation", arguments: JSON.stringify(args) },
            },
          ],
        },
      },
    ],
    usage: { prompt_tokens: 100, completion_tokens: 25, prompt_cache_miss_tokens: 100 },
  };
}

const BASE: EvaluateTimeOffArgs = {
  employeeName: "Jane Doe",
  rangeLabel: "Jun 15 – Jun 18",
  reasonText: "Family trip",
  band: "low",
  conflictCount: 0,
  uncoverableCount: 0,
  willAutoApprove: true,
};

describe("resolveTimeOffPolicy", () => {
  it("defaults to auto-approve + escalate when unset or malformed", () => {
    expect(resolveTimeOffPolicy(null)).toEqual({
      autoApproveLowImpact: true,
      escalateHighImpact: true,
    });
    expect(resolveTimeOffPolicy(undefined)).toEqual({
      autoApproveLowImpact: true,
      escalateHighImpact: true,
    });
    expect(resolveTimeOffPolicy("nope")).toEqual({
      autoApproveLowImpact: true,
      escalateHighImpact: true,
    });
    expect(resolveTimeOffPolicy({})).toEqual({
      autoApproveLowImpact: true,
      escalateHighImpact: true,
    });
  });

  it("reads stored overrides", () => {
    expect(resolveTimeOffPolicy({ autoApproveLowImpact: false })).toEqual({
      autoApproveLowImpact: false,
      escalateHighImpact: true,
    });
    expect(resolveTimeOffPolicy({ escalateHighImpact: false })).toEqual({
      autoApproveLowImpact: true,
      escalateHighImpact: false,
    });
  });

  it("ignores non-boolean values", () => {
    expect(resolveTimeOffPolicy({ autoApproveLowImpact: "yes" })).toEqual({
      autoApproveLowImpact: true,
      escalateHighImpact: true,
    });
  });
});

describe("classifyImpact", () => {
  it("is low when there are no conflicting shifts", () => {
    const { band, detail } = classifyImpact([]);
    expect(band).toBe("low");
    expect(detail).toEqual({ conflicts: [], uncoverable: 0 });
  });

  it("is low when every conflict has at least one eligible replacement", () => {
    const { band, detail } = classifyImpact([conflict(2, 0), conflict(1, 1)]);
    expect(band).toBe("low");
    expect(detail.uncoverable).toBe(0);
  });

  it("is medium when some conflicts are coverable and some are not", () => {
    const { band, detail } = classifyImpact([conflict(0, 0), conflict(3, 1)]);
    expect(band).toBe("medium");
    expect(detail.uncoverable).toBe(1);
  });

  it("is high when no conflict can be covered", () => {
    const { band, detail } = classifyImpact([conflict(0, 0), conflict(0, 1)]);
    expect(band).toBe("high");
    expect(detail.uncoverable).toBe(2);
  });

  it("is high for a single uncoverable conflict", () => {
    expect(classifyImpact([conflict(0, 0)]).band).toBe("high");
  });
});

describe("evaluateTimeOff", () => {
  it("returns the model's recommendation + message + category", async () => {
    const chat: DeepSeekChat = vi.fn(async () =>
      toolCall({
        recommendation: "Approve — every affected shift has cover.",
        message: "Thanks Jane, your time off is approved.",
        category: "family",
      }),
    );
    const result = await evaluateTimeOff(BASE, { chat });
    expect(result.recommendation).toContain("Approve");
    expect(result.category).toBe("family");
    expect(result.message).toContain("Jane");
  });

  it("passes the band + impact + reason into the prompt and meters usage", async () => {
    const onUsage = vi.fn();
    const chat: DeepSeekChat = vi.fn(async () =>
      toolCall({
        recommendation: "Review.",
        message: "We'll let your manager know.",
        category: "unspecified",
      }),
    );
    await evaluateTimeOff(
      { ...BASE, band: "high", conflictCount: 2, uncoverableCount: 2, willAutoApprove: false },
      { chat, onUsage },
    );
    const req = (chat as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      messages: Array<{ role: string; content: string }>;
    };
    const user = req.messages.find((m) => m.role === "user")?.content ?? "";
    expect(user).toContain("high");
    expect(user).toContain("Family trip");
    expect(user).toContain("pending");
    expect(onUsage).toHaveBeenCalledTimes(1);
  });
});

describe("deterministicEvaluation", () => {
  it("approves copy when auto-approving and no conflicts", () => {
    const e = deterministicEvaluation(BASE);
    expect(e.message).toContain("approved");
    expect(e.recommendation).toContain("no scheduled shifts");
    expect(e.category).toBe("unspecified");
  });

  it("notes available cover when conflicts are all coverable", () => {
    const e = deterministicEvaluation({ ...BASE, conflictCount: 3, uncoverableCount: 0 });
    expect(e.recommendation).toContain("available cover");
  });

  it("flags review when some conflicts are uncoverable", () => {
    const e = deterministicEvaluation({
      ...BASE,
      band: "medium",
      conflictCount: 3,
      uncoverableCount: 2,
      willAutoApprove: false,
    });
    expect(e.recommendation).toContain("Review");
    expect(e.recommendation).toContain("2 of 3");
    expect(e.message).toContain("manager");
  });

  it("falls back to 'there' when the name is empty", () => {
    const e = deterministicEvaluation({ ...BASE, employeeName: "" });
    expect(e.message).toContain("there");
  });
});

describe("formatting helpers", () => {
  it("renders a single-day range", () => {
    expect(rangeLabel("2026-06-15", "2026-06-15")).toBe("Jun 15");
  });

  it("renders a multi-day range", () => {
    expect(rangeLabel("2026-06-15", "2026-06-18")).toBe("Jun 15 – Jun 18");
  });

  it("builds a thread title", () => {
    expect(timeOffThreadTitle("Jane Doe", "Jun 15 – Jun 18")).toBe(
      "Time off — Jane Doe — Jun 15 – Jun 18",
    );
  });
});
