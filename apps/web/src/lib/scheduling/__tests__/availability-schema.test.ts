import { describe, expect, it } from "vitest";

import {
  permanentAvailabilitySchema,
  permanentDaySchema,
  temporaryOverrideSchema,
} from "../schemas";

/**
 * Day 44 — availability schema validation (pure, provider-free).
 */

describe("permanentDaySchema", () => {
  it("accepts an available day with a time window", () => {
    expect(
      permanentDaySchema.safeParse({
        day_of_week: 1,
        is_available: true,
        start_time: "09:00",
        end_time: "17:00",
      }).success,
    ).toBe(true);
  });

  it("accepts an available whole day (no times)", () => {
    expect(permanentDaySchema.safeParse({ day_of_week: 2, is_available: true }).success).toBe(true);
  });

  it("rejects end before start", () => {
    expect(
      permanentDaySchema.safeParse({
        day_of_week: 1,
        is_available: true,
        start_time: "17:00",
        end_time: "09:00",
      }).success,
    ).toBe(false);
  });

  it("rejects an out-of-range weekday", () => {
    expect(permanentDaySchema.safeParse({ day_of_week: 7, is_available: true }).success).toBe(
      false,
    );
  });
});

describe("permanentAvailabilitySchema", () => {
  it("accepts a full unique week", () => {
    const week = [0, 1, 2, 3, 4, 5, 6].map((d) => ({ day_of_week: d, is_available: d !== 0 }));
    expect(permanentAvailabilitySchema.safeParse(week).success).toBe(true);
  });

  it("rejects duplicate weekdays", () => {
    const dup = [
      { day_of_week: 1, is_available: true },
      { day_of_week: 1, is_available: false },
    ];
    expect(permanentAvailabilitySchema.safeParse(dup).success).toBe(false);
  });
});

describe("temporaryOverrideSchema", () => {
  it("accepts a single-day unavailable override", () => {
    expect(
      temporaryOverrideSchema.safeParse({ effective_date: "2026-06-20", is_available: false })
        .success,
    ).toBe(true);
  });

  it("accepts a dated range with a time window and note", () => {
    expect(
      temporaryOverrideSchema.safeParse({
        effective_date: "2026-06-20",
        end_date: "2026-06-25",
        is_available: false,
        start_time: "12:00",
        end_time: "18:00",
        notes: "Vacation",
      }).success,
    ).toBe(true);
  });

  it("rejects end_date before effective_date", () => {
    expect(
      temporaryOverrideSchema.safeParse({
        effective_date: "2026-06-25",
        end_date: "2026-06-20",
        is_available: true,
      }).success,
    ).toBe(false);
  });

  it("rejects end time before start time", () => {
    expect(
      temporaryOverrideSchema.safeParse({
        effective_date: "2026-06-20",
        is_available: true,
        start_time: "18:00",
        end_time: "12:00",
      }).success,
    ).toBe(false);
  });

  it("rejects a malformed date", () => {
    expect(
      temporaryOverrideSchema.safeParse({ effective_date: "June 20", is_available: true }).success,
    ).toBe(false);
  });
});
