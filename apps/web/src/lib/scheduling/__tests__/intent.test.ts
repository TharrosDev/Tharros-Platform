import { describe, expect, it, vi } from "vitest";

import type { DeepSeekChat, DeepSeekChatResponse } from "@/lib/deepseek/structured";

import { intentTranslationSchema, translateIntent } from "../intent";

/**
 * Day 47 — intent-translation agent. Provider-free: the DeepSeek chat fn is
 * injected, so these exercise the real prompt assembly + schema validation against
 * a fake tool call (no network, no key).
 */

const ROSTER = [
  { id: "emp-sarah", name: "Sarah" },
  { id: "emp-tom", name: "Tom" },
  { id: "emp-jamie", name: "Jamie" },
];

const VALID = {
  weights: { fairness: 2 },
  employeeAdjustments: [{ employeeId: "emp-sarah", targetHoursWeekly: 32 }],
  directives: [
    {
      type: "avoid_pairing",
      employeeIds: ["emp-tom", "emp-jamie"],
      note: "Don't schedule Tom and Jamie on the same shift.",
    },
  ],
  summary: "Spread hours more evenly, give Sarah ~32h, keep Tom and Jamie apart.",
  unmapped: [],
};

function toolCall(args: unknown, model = "deepseek-v4-pro"): DeepSeekChatResponse {
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
              function: { name: "record_scheduling_intent", arguments: JSON.stringify(args) },
            },
          ],
        },
      },
    ],
    usage: { prompt_tokens: 180, completion_tokens: 50, prompt_cache_miss_tokens: 180 },
  };
}

describe("translateIntent", () => {
  it("maps weights, per-employee hours, and unsupported asks into directives", async () => {
    const chat: DeepSeekChat = vi.fn(async () => toolCall(VALID));
    const result = await translateIntent(
      { text: "even out hours, Sarah ~32h, never pair Tom and Jamie", roster: ROSTER },
      { chat },
    );

    expect(result.weights).toMatchObject({ fairness: 2 });
    expect(result.employeeAdjustments?.[0]).toMatchObject({
      employeeId: "emp-sarah",
      targetHoursWeekly: 32,
    });
    expect(result.directives?.[0]).toMatchObject({
      type: "avoid_pairing",
      employeeIds: ["emp-tom", "emp-jamie"],
    });
  });

  it("passes the roster + current weights into the prompt, and defaults to the pro model", async () => {
    const chat: DeepSeekChat = vi.fn(async () => toolCall(VALID));
    await translateIntent({ text: "give Sarah more weekends", roster: ROSTER }, { chat });

    const req = (chat as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      model: string;
      messages: Array<{ role: string; content: string }>;
    };
    const system = req.messages.find((m) => m.role === "system")?.content ?? "";
    const user = req.messages.find((m) => m.role === "user")?.content ?? "";
    expect(system).toContain("coverageGapPenalty"); // the weight guide + current values
    expect(user).toContain("emp-sarah"); // roster ids are available for name→id resolution
    expect(req.model).toBe("deepseek-v4-pro");
  });

  it("forwards usage to onUsage for metering", async () => {
    const chat: DeepSeekChat = vi.fn(async () => toolCall(VALID));
    const onUsage = vi.fn();
    await translateIntent({ text: "even out hours", roster: ROSTER }, { chat, onUsage });
    expect(onUsage).toHaveBeenCalledWith(
      "deepseek-v4-pro",
      expect.objectContaining({ prompt_tokens: 180 }),
    );
  });
});

describe("intentTranslationSchema", () => {
  it("accepts a well-formed translation", () => {
    expect(intentTranslationSchema.safeParse(VALID).success).toBe(true);
  });

  it("requires a summary", () => {
    const { summary: _omit, ...noSummary } = VALID;
    expect(intentTranslationSchema.safeParse(noSummary).success).toBe(false);
  });

  it("rejects an unknown directive type", () => {
    const bad = { ...VALID, directives: [{ type: "teleport", note: "nope" }] };
    expect(intentTranslationSchema.safeParse(bad).success).toBe(false);
  });
});
