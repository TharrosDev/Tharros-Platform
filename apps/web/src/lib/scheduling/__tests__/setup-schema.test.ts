import { describe, expect, it } from "vitest";

import { schedulingSetupSchema } from "../schemas";

/**
 * Day 43 — scheduling setup wizard payload validation (pure, provider-free).
 */

function week(overrides: Partial<Record<number, unknown>> = {}) {
  // 7 days, all open 09:00–17:00 unless overridden.
  return [0, 1, 2, 3, 4, 5, 6].map(
    (d) =>
      overrides[d] ?? {
        day_of_week: d,
        opens_at: "09:00",
        closes_at: "17:00",
        is_closed: false,
      },
  );
}

const validPayload = {
  employees: [
    {
      name: "Jordan Lee",
      email: "Jordan@Example.com",
      employment_type: "part_time",
      role: "Server",
      is_minor: false,
      target_hours_weekly: "32",
    },
  ],
  businessHours: week(),
  staffing: [{ day_of_week: 1, start_time: "09:00", end_time: "17:00", min_staff: 2 }],
  labor: { preset: "ontario" },
  persona: { tone: "friendly", notes: "Greet by first name." },
};

describe("schedulingSetupSchema", () => {
  it("accepts a complete valid payload and lowercases email", () => {
    const parsed = schedulingSetupSchema.safeParse(validPayload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.employees[0].email).toBe("jordan@example.com");
      expect(parsed.data.employees[0].target_hours_weekly).toBe(32);
    }
  });

  it("requires exactly seven business-hours rows", () => {
    const parsed = schedulingSetupSchema.safeParse({
      ...validPayload,
      businessHours: week().slice(0, 5),
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects an open day missing its times", () => {
    const parsed = schedulingSetupSchema.safeParse({
      ...validPayload,
      businessHours: week({ 1: { day_of_week: 1, opens_at: "", closes_at: "", is_closed: false } }),
    });
    expect(parsed.success).toBe(false);
  });

  it("allows a closed day with no times", () => {
    const parsed = schedulingSetupSchema.safeParse({
      ...validPayload,
      businessHours: week({ 0: { day_of_week: 0, opens_at: "", closes_at: "", is_closed: true } }),
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a close time before the open time", () => {
    const parsed = schedulingSetupSchema.safeParse({
      ...validPayload,
      businessHours: week({
        2: { day_of_week: 2, opens_at: "17:00", closes_at: "09:00", is_closed: false },
      }),
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a bad email in the roster", () => {
    const parsed = schedulingSetupSchema.safeParse({
      ...validPayload,
      employees: [{ name: "No Email", email: "not-an-email" }],
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts an empty roster (team can be added later)", () => {
    const parsed = schedulingSetupSchema.safeParse({ ...validPayload, employees: [] });
    expect(parsed.success).toBe(true);
  });

  it("rejects an unknown labor preset", () => {
    const parsed = schedulingSetupSchema.safeParse({
      ...validPayload,
      labor: { preset: "quebec" },
    });
    expect(parsed.success).toBe(false);
  });

  it("defaults persona tone to professional and notes to empty", () => {
    const parsed = schedulingSetupSchema.safeParse({ ...validPayload, persona: {} });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.persona.tone).toBe("professional");
      expect(parsed.data.persona.notes).toBe("");
    }
  });
});
