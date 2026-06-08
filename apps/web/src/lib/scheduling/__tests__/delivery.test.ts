import { describe, expect, it } from "vitest";

import {
  REMINDER_LEAD_MS,
  assignedEmployeeIds,
  planReminders,
  type DeliveryShift,
} from "../delivery";

const NOW = Date.parse("2026-06-10T00:00:00Z");

function shift(id: string, employeeId: string | null, startsAt: string): DeliveryShift {
  return { id, employeeId, startsAt };
}

describe("assignedEmployeeIds", () => {
  it("returns distinct assigned employees and skips open shifts", () => {
    const ids = assignedEmployeeIds([
      shift("a", "e1", "2026-06-15T09:00:00Z"),
      shift("b", "e1", "2026-06-16T09:00:00Z"),
      shift("c", "e2", "2026-06-15T09:00:00Z"),
      shift("d", null, "2026-06-15T09:00:00Z"),
    ]);
    expect(ids.sort()).toEqual(["e1", "e2"]);
  });

  it("is empty when nothing is assigned", () => {
    expect(assignedEmployeeIds([shift("a", null, "2026-06-15T09:00:00Z")])).toEqual([]);
  });
});

describe("planReminders", () => {
  it("plans one reminder per assigned future shift, fired lead-time before start", () => {
    const plans = planReminders(
      [shift("a", "e1", "2026-06-15T09:00:00Z")],
      NOW,
    );
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({ shiftId: "a", employeeId: "e1" });
    expect(Date.parse(plans[0].runAt)).toBe(Date.parse("2026-06-15T09:00:00Z") - REMINDER_LEAD_MS);
  });

  it("skips open shifts", () => {
    expect(planReminders([shift("a", null, "2026-06-15T09:00:00Z")], NOW)).toHaveLength(0);
  });

  it("skips shifts whose reminder time is already past (start within the lead)", () => {
    // Starts 12h from NOW → reminder time (start − 24h) is in the past.
    const soon = new Date(NOW + 12 * 60 * 60 * 1000).toISOString();
    expect(planReminders([shift("a", "e1", soon)], NOW)).toHaveLength(0);
  });

  it("respects a custom lead", () => {
    const plans = planReminders(
      [shift("a", "e1", "2026-06-15T09:00:00Z")],
      NOW,
      2 * 60 * 60 * 1000,
    );
    expect(Date.parse(plans[0].runAt)).toBe(
      Date.parse("2026-06-15T09:00:00Z") - 2 * 60 * 60 * 1000,
    );
  });
});
