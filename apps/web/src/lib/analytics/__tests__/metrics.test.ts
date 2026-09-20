import { describe, expect, it } from "vitest";

import {
  attendanceReliability,
  dailyAssignedHours,
  deriveEmployeeAnalytics,
  deriveOrgAnalytics,
  formatPercent,
  ratio,
  reliabilityBand,
  type EmployeeRaw,
  type OverviewRaw,
} from "@/lib/analytics/metrics";

/**
 * Day 59 — pure scheduling-analytics math. No DB; the SQL RPCs supply raw counts
 * and this derives the rates + scores the dashboard renders.
 */

const overview = (over: Partial<OverviewRaw> = {}): OverviewRaw => ({
  assigned_shifts: 0,
  open_shifts: 0,
  assigned_hours: 0,
  open_hours: 0,
  sick_calls: 0,
  offers: 0,
  offers_accepted: 0,
  swaps: 0,
  time_off: 0,
  ...over,
});

describe("ratio + formatPercent", () => {
  it("returns null on a zero denominator and never divides by zero", () => {
    expect(ratio(3, 0)).toBeNull();
    expect(ratio(0, 0)).toBeNull();
    expect(formatPercent(null)).toBe("—");
  });

  it("computes and formats a rate", () => {
    expect(ratio(81, 100)).toBe(0.81);
    expect(formatPercent(0.8123)).toBe("81%");
    expect(formatPercent(0.8123, 1)).toBe("81.2%");
  });
});

describe("deriveOrgAnalytics", () => {
  it("derives utilization, efficiency, acceptance, and the staffing gap", () => {
    const o = deriveOrgAnalytics(
      overview({
        assigned_shifts: 8,
        open_shifts: 2,
        assigned_hours: 64,
        open_hours: 16,
        sick_calls: 3,
        offers: 5,
        offers_accepted: 4,
        swaps: 1,
        time_off: 2,
      }),
    );
    expect(o.totalShifts).toBe(10);
    expect(o.laborUtilization).toBe(0.8); // 64 / 80
    expect(o.scheduleEfficiency).toBe(0.8); // 8 / 10
    expect(o.acceptanceRate).toBe(0.8); // 4 / 5
    expect(o.staffingGap).toEqual({ openShifts: 2, openHours: 16 });
    expect(o.sickCalls).toBe(3);
  });

  it("is null-safe for an empty window", () => {
    const o = deriveOrgAnalytics(overview());
    expect(o.laborUtilization).toBeNull();
    expect(o.scheduleEfficiency).toBeNull();
    expect(o.acceptanceRate).toBeNull();
    expect(o.totalShifts).toBe(0);
  });

  it("coerces PostgREST numeric-as-string hours", () => {
    const o = deriveOrgAnalytics(
      overview({
        assigned_shifts: 1,
        assigned_hours: "7.5" as unknown as number,
        open_hours: "2.5" as unknown as number,
        open_shifts: 1,
      }),
    );
    expect(o.assignedHours).toBe(7.5);
    expect(o.laborUtilization).toBe(0.75); // 7.5 / 10
  });
});

describe("attendanceReliability + band", () => {
  it("scores worked ÷ (worked + call-outs)", () => {
    expect(attendanceReliability(9, 1)).toBe(0.9);
    expect(attendanceReliability(3, 1)).toBe(0.75);
    expect(attendanceReliability(0, 0)).toBeNull();
  });

  it("bands the score", () => {
    expect(reliabilityBand(0.95)).toBe("good");
    expect(reliabilityBand(0.8)).toBe("watch");
    expect(reliabilityBand(0.5)).toBe("poor");
    expect(reliabilityBand(null)).toBe("none");
  });
});

describe("deriveEmployeeAnalytics", () => {
  const raw: EmployeeRaw = {
    employee_id: "e1",
    name: "Alex",
    assigned_shifts: 10,
    assigned_hours: 72,
    sick_calls: 0,
    offers: 2,
    offers_accepted: 1,
    swaps: 1,
    time_off: 0,
  };

  it("maps and derives per-employee scores", () => {
    const e = deriveEmployeeAnalytics(raw);
    expect(e.name).toBe("Alex");
    expect(e.assignedHours).toBe(72);
    expect(e.reliability).toBe(1); // 10 / (10 + 0)
    expect(e.acceptanceRate).toBe(0.5); // 1 / 2
  });

  it("nulls acceptance when never offered a replacement", () => {
    const e = deriveEmployeeAnalytics({ ...raw, offers: 0, offers_accepted: 0 });
    expect(e.acceptanceRate).toBeNull();
  });
});

describe("dailyAssignedHours", () => {
  it("buckets net hours by start date over the trailing window", () => {
    const rows = [
      {
        starts_at: "2026-06-09T09:00:00Z",
        ends_at: "2026-06-09T17:00:00Z",
        employee_id: "a",
        break_minutes: 30,
      },
      {
        starts_at: "2026-06-09T10:00:00Z",
        ends_at: "2026-06-09T14:00:00Z",
        employee_id: "b",
        break_minutes: null,
      },
      {
        starts_at: "2026-06-10T09:00:00Z",
        ends_at: "2026-06-10T12:00:00Z",
        employee_id: "a",
        break_minutes: 0,
      },
    ];
    const out = dailyAssignedHours(rows, "2026-06-10", 3);
    expect(out).toEqual([
      { date: "2026-06-08", hours: 0 },
      { date: "2026-06-09", hours: 11.5 },
      { date: "2026-06-10", hours: 3 },
    ]);
  });

  it("ignores open shifts, out-of-window days, and malformed rows", () => {
    const rows = [
      {
        starts_at: "2026-06-10T09:00:00Z",
        ends_at: "2026-06-10T17:00:00Z",
        employee_id: null,
        break_minutes: 0,
      },
      {
        starts_at: "2026-05-01T09:00:00Z",
        ends_at: "2026-05-01T17:00:00Z",
        employee_id: "a",
        break_minutes: 0,
      },
      { starts_at: "bad", ends_at: "2026-06-10T17:00:00Z", employee_id: "a", break_minutes: 0 },
      {
        starts_at: "2026-06-10T17:00:00Z",
        ends_at: "2026-06-10T09:00:00Z",
        employee_id: "a",
        break_minutes: 0,
      },
    ];
    const out = dailyAssignedHours(rows, "2026-06-10", 2);
    expect(out).toEqual([
      { date: "2026-06-09", hours: 0 },
      { date: "2026-06-10", hours: 0 },
    ]);
  });

  it("returns empty for a nonsense window", () => {
    expect(dailyAssignedHours([], "not-a-date", 7)).toEqual([]);
    expect(dailyAssignedHours([], "2026-06-10", 0)).toEqual([]);
  });
});
