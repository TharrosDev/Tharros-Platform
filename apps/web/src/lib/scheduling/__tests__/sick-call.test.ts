import { describe, expect, it, vi } from "vitest";

import type { DeepSeekChat, DeepSeekChatResponse } from "@/lib/deepseek/structured";

import {
  confirmSickCall,
  deterministicConfirmation,
  resolveSickCallReasonPolicy,
  shiftLabel,
  sickCallThreadTitle,
  type ConfirmSickCallArgs,
} from "../sick-call";

/**
 * Day 54 — sick-call confirmation + config helpers. Provider-free: the DeepSeek
 * chat fn is injected, so these exercise the real prompt assembly + schema
 * validation against a fake tool call (no network, no key). The DB orchestration
 * (`processSickCall`) is covered by the live `sick-call.db.test.ts` harness.
 */

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
              function: { name: "record_sick_call", arguments: JSON.stringify(args) },
            },
          ],
        },
      },
    ],
    usage: { prompt_tokens: 120, completion_tokens: 30, prompt_cache_miss_tokens: 120 },
  };
}

const BASE: ConfirmSickCallArgs = {
  employeeName: "Jane Doe",
  shiftLabel: "Mon Jun 15, 9:00 AM – 5:00 PM",
  reasonText: "I have a fever",
  policy: "optional",
};

describe("resolveSickCallReasonPolicy", () => {
  it("defaults to 'optional' when unset or malformed", () => {
    expect(resolveSickCallReasonPolicy(null)).toBe("optional");
    expect(resolveSickCallReasonPolicy(undefined)).toBe("optional");
    expect(resolveSickCallReasonPolicy({})).toBe("optional");
    expect(resolveSickCallReasonPolicy({ sickCallReason: "nope" })).toBe("optional");
    expect(resolveSickCallReasonPolicy("not-an-object")).toBe("optional");
  });

  it("reads a valid stored policy", () => {
    expect(resolveSickCallReasonPolicy({ sickCallReason: "required" })).toBe("required");
    expect(resolveSickCallReasonPolicy({ sickCallReason: "hidden" })).toBe("hidden");
    expect(resolveSickCallReasonPolicy({ tone: "friendly", sickCallReason: "optional" })).toBe(
      "optional",
    );
  });
});

describe("confirmSickCall", () => {
  it("returns the model's normalized reason + confirmation", async () => {
    const chat: DeepSeekChat = vi.fn(async () =>
      toolCall({
        normalizedReason: "Illness (fever)",
        confirmationMessage: "Thanks Jane, your manager has been told.",
        category: "illness",
      }),
    );
    const result = await confirmSickCall(BASE, { chat });
    expect(result.normalizedReason).toBe("Illness (fever)");
    expect(result.category).toBe("illness");
    expect(result.confirmationMessage).toContain("Jane");
  });

  it("forces no reason when the policy is 'hidden', even if the model returns one", async () => {
    const chat: DeepSeekChat = vi.fn(async () =>
      toolCall({
        normalizedReason: "Illness (fever)",
        confirmationMessage: "Got it, we'll find cover.",
        category: "illness",
      }),
    );
    const result = await confirmSickCall({ ...BASE, policy: "hidden" }, { chat });
    expect(result.normalizedReason).toBeNull();
    expect(result.category).toBe("unspecified");
  });

  it("passes the shift label + reason into the prompt and meters usage", async () => {
    const onUsage = vi.fn();
    const chat: DeepSeekChat = vi.fn(async () =>
      toolCall({
        normalizedReason: null,
        confirmationMessage: "Thanks for the heads up.",
        category: "unspecified",
      }),
    );
    await confirmSickCall(BASE, { chat, onUsage });

    const req = (chat as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      messages: Array<{ role: string; content: string }>;
    };
    const user = req.messages.find((m) => m.role === "user")?.content ?? "";
    expect(user).toContain("Mon Jun 15, 9:00 AM – 5:00 PM");
    expect(user).toContain("I have a fever");
    expect(onUsage).toHaveBeenCalledTimes(1);
  });
});

describe("deterministicConfirmation", () => {
  it("greets by first name and keeps the reason when given", () => {
    const c = deterministicConfirmation(BASE);
    expect(c.confirmationMessage).toContain("Jane");
    expect(c.normalizedReason).toBe("I have a fever");
    expect(c.category).toBe("unspecified");
  });

  it("drops the reason when the policy is 'hidden'", () => {
    const c = deterministicConfirmation({ ...BASE, policy: "hidden" });
    expect(c.normalizedReason).toBeNull();
  });

  it("falls back to 'there' when the name is empty", () => {
    const c = deterministicConfirmation({ ...BASE, employeeName: "", reasonText: "" });
    expect(c.confirmationMessage).toContain("there");
    expect(c.normalizedReason).toBeNull();
  });
});

describe("formatting helpers", () => {
  it("renders a shift label in the business wall clock (UTC accessors)", () => {
    // 2026-06-15 is a Monday. Stored timestamptz (UTC-stamped) → UTC accessors
    // render the business wall clock.
    const label = shiftLabel("2026-06-15T09:00:00Z", "2026-06-15T17:00:00Z");
    expect(label).toContain("Mon");
    expect(label).toContain("9:00");
    expect(label).toContain("5:00");
  });

  it("builds a thread title", () => {
    expect(sickCallThreadTitle("Jane Doe", "Mon Jun 15")).toBe(
      "Sick call — Jane Doe — Mon Jun 15",
    );
  });
});
