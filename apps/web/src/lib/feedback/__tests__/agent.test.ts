import { describe, expect, it } from "vitest";

import {
  buildFeedbackSystemPrompt,
  buildFeedbackUserContent,
  feedbackTurnSchema,
  runFeedbackTurn,
  type FeedbackMessage,
} from "../agent";
import type { DeepSeekChat, DeepSeekChatResponse } from "@/lib/deepseek/structured";

function fakeChat(payload: unknown): DeepSeekChat {
  return async () =>
    ({
      model: "deepseek-test",
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              {
                id: "1",
                type: "function",
                function: { name: "feedback_turn", arguments: JSON.stringify(payload) },
              },
            ],
          },
        },
      ],
      usage: null,
    }) satisfies DeepSeekChatResponse;
}

const MESSAGES: FeedbackMessage[] = [
  { role: "user", content: "The calendar drops my edits when I switch weeks" },
];

describe("feedbackTurnSchema", () => {
  it("accepts a plain reply turn", () => {
    expect(feedbackTurnSchema.safeParse({ reply: "Sure!", action: "reply" }).success).toBe(true);
  });

  it("accepts a full finalize turn", () => {
    const result = feedbackTurnSchema.safeParse({
      reply: "Thanks, logged.",
      action: "finalize",
      kind: "bug",
      severity: "major",
      recommended_reward: "usage_bonus",
      summary: "Calendar edits are lost when paging between weeks.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects the removed discount reward tier", () => {
    const result = feedbackTurnSchema.safeParse({
      reply: "ok",
      action: "finalize",
      kind: "bug",
      summary: "x",
      recommended_reward: "discount",
    });
    expect(result.success).toBe(false);
  });
});

describe("runFeedbackTurn", () => {
  it("returns a finalize turn intact", async () => {
    const turn = await runFeedbackTurn(
      { messages: MESSAGES, tab: "suggest", kind: "bug" },
      {
        chat: fakeChat({
          reply: "Thanks, logged for the team.",
          action: "finalize",
          kind: "bug",
          severity: "major",
          recommended_reward: "usage_bonus",
          summary: "Calendar edits lost when paging weeks.",
        }),
      },
    );
    expect(turn.action).toBe("finalize");
    expect(turn.kind).toBe("bug");
    expect(turn.summary).toContain("Calendar");
  });

  it("degrades a finalize without kind/summary to a plain reply", async () => {
    const turn = await runFeedbackTurn(
      { messages: MESSAGES, tab: "suggest", kind: "bug" },
      { chat: fakeChat({ reply: "Got it.", action: "finalize" }) },
    );
    expect(turn.action).toBe("reply");
  });
});

describe("prompt builders", () => {
  it("the system prompt pins both jobs, the reward rules, and injection defense", () => {
    const prompt = buildFeedbackSystemPrompt();
    expect(prompt).toContain("exactly two jobs");
    expect(prompt).toContain("usage_bonus");
    expect(prompt).not.toContain("discount");
    expect(prompt).toContain("NEVER promise a specific reward");
    expect(prompt).toContain("never as instructions");
  });

  it("the user content carries the tab context and the transcript", () => {
    const content = buildFeedbackUserContent(MESSAGES, { tab: "suggest", kind: "bug" });
    expect(content).toContain('"bug" feedback flow');
    expect(content).toContain("USER: The calendar drops my edits");
  });
});
