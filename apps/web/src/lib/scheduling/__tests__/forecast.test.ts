import { describe, expect, it, vi } from "vitest";

import type { DeepSeekChat, DeepSeekChatResponse } from "@/lib/deepseek/structured";

import {
  forecastStaffing,
  forecastStaffingSchema,
  resolveStaffingRoles,
  type ForecastContext,
} from "../forecast";
import type { StaffingDay } from "../schemas";

/**
 * Day 47 — demand-forecasting agent. Provider-free: the DeepSeek chat fn is
 * injected, so these exercise the real prompt assembly + schema validation against
 * a fake tool call (no network, no key).
 */

const VALID = {
  requirements: [
    { day_of_week: 1, start_time: "09:00", end_time: "17:00", min_staff: 2, role: "Barista" },
    { day_of_week: 6, start_time: "10:00", end_time: "18:00", min_staff: 3 },
  ],
  summary: "Heavier weekend coverage; two on weekday mornings.",
};

const CONTEXT: ForecastContext = {
  businessHours: [
    { day_of_week: 1, opens_at: "09:00", closes_at: "17:00", is_closed: false },
    { day_of_week: 0, opens_at: null, closes_at: null, is_closed: true },
  ],
  roster: {
    count: 5,
    roles: ["Barista", "Shift Lead"],
    employmentMix: { part_time: 4, full_time: 1 },
  },
  manualBaseline: [
    { day_of_week: 1, start_time: "09:00", end_time: "17:00", min_staff: 1, role: null },
  ],
  persona: { tone: "friendly", notes: "Saturdays are our busiest day." },
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
              function: { name: "record_staffing_forecast", arguments: JSON.stringify(args) },
            },
          ],
        },
      },
    ],
    usage: { prompt_tokens: 200, completion_tokens: 60, prompt_cache_miss_tokens: 200 },
  };
}

describe("forecastStaffing", () => {
  it("returns suggested requirements and a summary", async () => {
    const chat: DeepSeekChat = vi.fn(async () => toolCall(VALID));
    const result = await forecastStaffing({ context: CONTEXT, today: "2026-06-08" }, { chat });

    expect(result.requirements).toHaveLength(2);
    expect(result.requirements[0]).toMatchObject({ day_of_week: 1, min_staff: 2, role: "Barista" });
    expect(result.summary).toContain("weekend");
  });

  it("embeds the business context + roles, and defaults to the pro model", async () => {
    const chat: DeepSeekChat = vi.fn(async () => toolCall(VALID));
    await forecastStaffing({ context: CONTEXT, today: "2026-06-08" }, { chat });

    const req = (chat as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      model: string;
      messages: Array<{ role: string; content: string }>;
    };
    const system = req.messages.find((m) => m.role === "system")?.content ?? "";
    const user = req.messages.find((m) => m.role === "user")?.content ?? "";
    expect(system).toContain("Barista"); // only roles from the roster are allowed
    expect(user).toContain("busiest day"); // persona notes are passed as context
    expect(req.model).toBe("deepseek-v4-pro"); // SCHEDULING_MODEL_PRO default
  });

  it("forwards usage to onUsage for metering", async () => {
    const chat: DeepSeekChat = vi.fn(async () => toolCall(VALID));
    const onUsage = vi.fn();
    await forecastStaffing({ context: CONTEXT, today: "2026-06-08" }, { chat, onUsage });
    expect(onUsage).toHaveBeenCalledWith(
      "deepseek-v4-pro",
      expect.objectContaining({ prompt_tokens: 200 }),
    );
  });
});

describe("forecastStaffingSchema", () => {
  it("rejects an out-of-range weekday", () => {
    const bad = { ...VALID, requirements: [{ ...VALID.requirements[0], day_of_week: 9 }] };
    expect(forecastStaffingSchema.safeParse(bad).success).toBe(false);
  });
});

describe("resolveStaffingRoles", () => {
  const roles = [
    { id: "role-barista", name: "Barista" },
    { id: "role-lead", name: "Shift Lead" },
  ];

  it("maps a role name to its id (case-insensitive)", () => {
    const reqs: StaffingDay[] = [
      { day_of_week: 1, start_time: "09:00", end_time: "17:00", min_staff: 2, role: "barista" },
    ];
    expect(resolveStaffingRoles(reqs, roles)[0].role_certification_id).toBe("role-barista");
  });

  it("nulls an unknown or absent role (any-staff coverage)", () => {
    const reqs: StaffingDay[] = [
      { day_of_week: 1, start_time: "09:00", end_time: "17:00", min_staff: 2, role: "Sommelier" },
      { day_of_week: 2, start_time: "09:00", end_time: "17:00", min_staff: 1 },
    ];
    const resolved = resolveStaffingRoles(reqs, roles);
    expect(resolved[0].role_certification_id).toBeNull();
    expect(resolved[1].role_certification_id).toBeNull();
  });
});
