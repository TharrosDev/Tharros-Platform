import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { Message } from "@anthropic-ai/sdk/resources/messages";

import {
  generateStructured,
  StructuredOutputError,
  type StructuredAnthropic,
} from "@/lib/agents/structured-output";

/**
 * Day 39 — structured-output harness. Pure, provider-free (mocked SDK).
 */

const schema = z.object({ name: z.string(), count: z.number() });

/** Build a minimal Message whose forced tool call carries `input`. */
function toolMessage(input: unknown): Message {
  return {
    id: "msg_1",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-4-6",
    stop_reason: "tool_use",
    stop_sequence: null,
    content: [{ type: "tool_use", id: "tu_1", name: "record_output", input } as never],
    usage: { input_tokens: 10, output_tokens: 5 } as never,
  } as unknown as Message;
}

function fakeAnthropic(responses: Message[]): { client: StructuredAnthropic; create: ReturnType<typeof vi.fn> } {
  let i = 0;
  const create = vi.fn(async () => responses[Math.min(i++, responses.length - 1)]);
  return { client: { messages: { create } }, create };
}

describe("generateStructured", () => {
  it("returns validated data on the first attempt and forces the tool", async () => {
    const { client, create } = fakeAnthropic([toolMessage({ name: "Sara", count: 3 })]);
    const onUsage = vi.fn();

    const result = await generateStructured({
      anthropic: client,
      schema,
      system: "sys",
      userContent: "make it",
      onUsage,
    });

    expect(result.data).toEqual({ name: "Sara", count: 3 });
    expect(result.attempts).toBe(1);
    expect(onUsage).toHaveBeenCalledTimes(1);

    const req = create.mock.calls[0][0] as Record<string, unknown>;
    expect(req.tool_choice).toEqual({ type: "tool", name: "record_output" });
    expect(req.thinking).toBeUndefined(); // forced tool_choice excludes thinking
  });

  it("retries with a correction turn, then succeeds", async () => {
    const { client, create } = fakeAnthropic([
      toolMessage({ name: "Sara" }), // missing count → invalid
      toolMessage({ name: "Sara", count: 7 }), // corrected
    ]);

    const result = await generateStructured({
      anthropic: client,
      schema,
      system: "sys",
      userContent: "make it",
    });

    expect(result.data).toEqual({ name: "Sara", count: 7 });
    expect(result.attempts).toBe(2);
    expect(create).toHaveBeenCalledTimes(2);
    // The retry carried the prior assistant turn + a correction user turn.
    const retryReq = create.mock.calls[1][0] as { messages: unknown[] };
    expect(retryReq.messages).toHaveLength(3);
  });

  it("throws StructuredOutputError after exhausting retries", async () => {
    const { client, create } = fakeAnthropic([toolMessage({ wrong: true })]);

    await expect(
      generateStructured({
        anthropic: client,
        schema,
        system: "sys",
        userContent: "make it",
        maxRetries: 1,
      }),
    ).rejects.toBeInstanceOf(StructuredOutputError);
    expect(create).toHaveBeenCalledTimes(2); // first + 1 retry
  });
});
