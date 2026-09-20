import { describe, expect, it, vi } from "vitest";

import type { DeepSeekChat, DeepSeekChatResponse } from "@/lib/deepseek/structured";

import { parseAvailabilityText, parsedAvailabilitySchema } from "../availability-parse";

/**
 * Day 45 — availability NL-parse. Provider-free: the DeepSeek chat fn is injected,
 * so these exercise the real prompt assembly + schema validation against a fake
 * tool call (no network, no key).
 */

const VALID = {
  permanent: [
    { day_of_week: 1, is_available: true },
    { day_of_week: 2, is_available: true, start_time: "09:00", end_time: "17:00" },
  ],
  temporary: [
    {
      effective_date: "2026-06-20",
      end_date: "2026-06-25",
      is_available: false,
      notes: "Vacation",
    },
  ],
  summary: "You can work Mondays, and Tuesdays 9–5. Off June 20–25.",
};

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
              function: { name: "record_availability", arguments: JSON.stringify(args) },
            },
          ],
        },
      },
    ],
    usage: { prompt_tokens: 120, completion_tokens: 40, prompt_cache_miss_tokens: 120 },
  };
}

describe("parseAvailabilityText", () => {
  it("returns the workable days, overrides, and a plain-language summary", async () => {
    const chat: DeepSeekChat = vi.fn(async () => toolCall(VALID));

    const result = await parseAvailabilityText(
      { text: "I can do Mondays, Tuesdays 9 to 5, off June 20-25", today: "2026-06-08" },
      { chat },
    );

    expect(result.permanent).toHaveLength(2);
    expect(result.temporary[0]).toMatchObject({
      effective_date: "2026-06-20",
      is_available: false,
    });
    expect(result.summary).toContain("Mondays");
  });

  it("injects today's date so relative phrases can be resolved", async () => {
    const chat: DeepSeekChat = vi.fn(async () => toolCall(VALID));

    await parseAvailabilityText({ text: "off next Friday", today: "2026-06-08" }, { chat });

    const req = (chat as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      model: string;
      messages: Array<{ role: string; content: string }>;
    };
    const system = req.messages.find((m) => m.role === "system")?.content ?? "";
    expect(system).toContain("2026-06-08");
    expect(req.model).toBe("deepseek-v4-flash"); // SCHEDULING_MODEL default
  });

  it("forwards DeepSeek usage to onUsage for metering", async () => {
    const chat: DeepSeekChat = vi.fn(async () => toolCall(VALID));
    const onUsage = vi.fn();

    await parseAvailabilityText({ text: "Mondays", today: "2026-06-08" }, { chat, onUsage });

    expect(onUsage).toHaveBeenCalledWith(
      "deepseek-v4-flash",
      expect.objectContaining({ prompt_tokens: 120 }),
    );
  });

  it("feeds a prior parse back as context when correcting", async () => {
    const chat: DeepSeekChat = vi.fn(async () => toolCall(VALID));

    await parseAvailabilityText(
      { text: "actually I can't do Tuesdays", today: "2026-06-08", priorParse: VALID },
      { chat },
    );

    const req = (chat as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      messages: Array<{ role: string; content: string }>;
    };
    const user = req.messages.find((m) => m.role === "user")?.content ?? "";
    expect(user).toContain("Vacation"); // the prior parse is included for the correction
  });
});

describe("parsedAvailabilitySchema", () => {
  it("accepts a well-formed parse", () => {
    expect(parsedAvailabilitySchema.safeParse(VALID).success).toBe(true);
  });

  it("rejects an out-of-range weekday", () => {
    const bad = { ...VALID, permanent: [{ day_of_week: 7, is_available: true }] };
    expect(parsedAvailabilitySchema.safeParse(bad).success).toBe(false);
  });
});
