import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  DeepSeekStructuredError,
  generateStructuredDeepSeek,
  type DeepSeekChat,
  type DeepSeekChatResponse,
} from "../structured";

/**
 * Day 45 — DeepSeek structured-output harness. Provider-free: the chat completion
 * fn is injected, so these exercise the real forced-tool + zod-validate + retry
 * logic against a fake DeepSeek/OpenAI response shape (no network, no key).
 */

const schema = z.object({ day: z.number().int().min(0).max(6), available: z.boolean() });

/** Build a DeepSeek/OpenAI-shaped response that forces `record_output` with `args`. */
function toolCall(args: unknown, model = "deepseek-v4-flash"): DeepSeekChatResponse {
  return {
    model,
    choices: [
      {
        message: {
          content: null,
          tool_calls: [
            {
              id: "call_1",
              type: "function",
              function: { name: "record_output", arguments: JSON.stringify(args) },
            },
          ],
        },
      },
    ],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 5,
      prompt_cache_hit_tokens: 0,
      prompt_cache_miss_tokens: 10,
    },
  };
}

const baseArgs = {
  schema,
  system: "Return the result.",
  userContent: "Monday is workable.",
};

describe("generateStructuredDeepSeek", () => {
  it("returns validated data on the first attempt", async () => {
    const chat: DeepSeekChat = vi.fn(async () => toolCall({ day: 1, available: true }));

    const result = await generateStructuredDeepSeek({ ...baseArgs, chat });

    expect(result.data).toEqual({ day: 1, available: true });
    expect(result.attempts).toBe(1);
    expect(chat).toHaveBeenCalledTimes(1);
  });

  it("offers the tool via auto tool_choice (thinking-mode compatible) and sends system + user", async () => {
    const chat: DeepSeekChat = vi.fn(async () => toolCall({ day: 0, available: false }));

    await generateStructuredDeepSeek({ ...baseArgs, chat });

    const req = (chat as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>;
    // Thinking mode rejects a forced named function — must be "auto".
    expect(req.tool_choice).toBe("auto");
    const tools = req.tools as Array<{ function: { name: string } }>;
    expect(tools[0].function.name).toBe("record_output");
    const messages = req.messages as Array<{ role: string; content: string }>;
    expect(messages[0]).toEqual({ role: "system", content: "Return the result." });
    expect(messages.at(-1)).toEqual({ role: "user", content: "Monday is workable." });
  });

  it("retries with a correction turn on a schema miss, then succeeds", async () => {
    const chat: DeepSeekChat = vi
      .fn()
      .mockResolvedValueOnce(toolCall({ day: 9, available: true })) // out of range
      .mockResolvedValueOnce(toolCall({ day: 2, available: true }));

    const result = await generateStructuredDeepSeek({ ...baseArgs, chat });

    expect(result.data).toEqual({ day: 2, available: true });
    expect(result.attempts).toBe(2);
    // The second call must carry a correction message appended after the first.
    const secondReq = (chat as ReturnType<typeof vi.fn>).mock.calls[1][0] as {
      messages: Array<{ role: string; content: string }>;
    };
    expect(secondReq.messages.length).toBeGreaterThan(2);
    expect(secondReq.messages.at(-1)?.role).toBe("user");
    expect(secondReq.messages.at(-1)?.content).toMatch(/did not match/i);
  });

  it("treats unparseable JSON arguments as a miss and retries", async () => {
    const bad: DeepSeekChatResponse = {
      model: "deepseek-v4-flash",
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              {
                id: "c",
                type: "function",
                function: { name: "record_output", arguments: "{not json" },
              },
            ],
          },
        },
      ],
      usage: null,
    };
    const chat: DeepSeekChat = vi
      .fn()
      .mockResolvedValueOnce(bad)
      .mockResolvedValueOnce(toolCall({ day: 3, available: false }));

    const result = await generateStructuredDeepSeek({ ...baseArgs, chat });

    expect(result.data).toEqual({ day: 3, available: false });
    expect(result.attempts).toBe(2);
  });

  it("throws DeepSeekStructuredError after exhausting retries", async () => {
    const chat: DeepSeekChat = vi.fn(async () => toolCall({ day: 99, available: true }));

    await expect(
      generateStructuredDeepSeek({ ...baseArgs, chat, maxRetries: 1 }),
    ).rejects.toBeInstanceOf(DeepSeekStructuredError);
    expect(chat).toHaveBeenCalledTimes(2); // first attempt + 1 retry
  });

  it("reports usage from every model call to onUsage", async () => {
    const chat: DeepSeekChat = vi.fn(async () => toolCall({ day: 1, available: true }));
    const onUsage = vi.fn();

    await generateStructuredDeepSeek({ ...baseArgs, chat, onUsage });

    expect(onUsage).toHaveBeenCalledTimes(1);
    expect(onUsage).toHaveBeenCalledWith(
      "deepseek-v4-flash",
      expect.objectContaining({ prompt_tokens: 10 }),
    );
  });
});
