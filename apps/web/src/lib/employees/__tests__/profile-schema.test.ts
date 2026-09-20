import { describe, expect, it } from "vitest";

import { employeeProfileSchema, roleAssignmentSchema, roleCertificationSchema } from "../schemas";
import { summarizeHours } from "../hours";

describe("employeeProfileSchema", () => {
  it("accepts a full valid profile", () => {
    const r = employeeProfileSchema.safeParse({
      employment_type: "full_time",
      phone: "613-555-0199",
      seniority_rank: 3,
      hire_date: "2024-01-15",
      is_minor: false,
      target_hours_weekly: 40,
      min_hours_weekly: 20,
      max_hours_weekly: 44,
      performance_score: 88,
      notes: "Reliable opener.",
    });
    expect(r.success).toBe(true);
  });

  it("coerces empty optional fields to undefined", () => {
    const r = employeeProfileSchema.safeParse({
      employment_type: "part_time",
      phone: "",
      seniority_rank: "",
      hire_date: "",
      target_hours_weekly: "",
      performance_score: "",
      notes: "",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.seniority_rank).toBeUndefined();
      expect(r.data.target_hours_weekly).toBeUndefined();
      expect(r.data.is_minor).toBe(false); // defaulted
    }
  });

  it("rejects an invalid employment type", () => {
    const r = employeeProfileSchema.safeParse({ employment_type: "freelance" });
    expect(r.success).toBe(false);
  });

  it("rejects out-of-range hours and score", () => {
    expect(employeeProfileSchema.safeParse({ target_hours_weekly: 200 }).success).toBe(false);
    expect(employeeProfileSchema.safeParse({ performance_score: 150 }).success).toBe(false);
  });

  it("rejects a malformed hire date", () => {
    expect(employeeProfileSchema.safeParse({ hire_date: "15-01-2024" }).success).toBe(false);
  });
});

describe("roleCertificationSchema", () => {
  it("accepts a role and defaults kind", () => {
    const r = roleCertificationSchema.safeParse({ name: "Shift Lead" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.kind).toBe("role");
  });
  it("rejects an empty name", () => {
    expect(roleCertificationSchema.safeParse({ name: "  " }).success).toBe(false);
  });
});

describe("roleAssignmentSchema", () => {
  it("requires uuids", () => {
    expect(
      roleAssignmentSchema.safeParse({ employeeId: "x", roleCertificationId: "y" }).success,
    ).toBe(false);
  });
  it("accepts uuids + optional expiry", () => {
    const r = roleAssignmentSchema.safeParse({
      employeeId: "11111111-1111-4111-8111-111111111111",
      roleCertificationId: "22222222-2222-4222-8222-222222222222",
      expiresAt: "2027-01-01",
    });
    expect(r.success).toBe(true);
  });
});

describe("summarizeHours", () => {
  it("sums net hours (minus break) across shifts", () => {
    const s = summarizeHours([
      { startsAt: "2026-06-08T09:00:00Z", endsAt: "2026-06-08T17:30:00Z", breakMinutes: 30 },
      { startsAt: "2026-06-09T09:00:00Z", endsAt: "2026-06-09T13:00:00Z", breakMinutes: 0 },
    ]);
    expect(s.totalHours).toBe(12); // 8 + 4
  });

  it("groups by ISO week", () => {
    const s = summarizeHours([
      { startsAt: "2026-06-08T09:00:00Z", endsAt: "2026-06-08T13:00:00Z", breakMinutes: 0 }, // wk A
      { startsAt: "2026-06-15T09:00:00Z", endsAt: "2026-06-15T12:00:00Z", breakMinutes: 0 }, // wk B
    ]);
    expect(s.weeks).toHaveLength(2);
    expect(s.weeks[0].hours).toBe(4);
    expect(s.weeks[1].hours).toBe(3);
  });

  it("is empty for no shifts", () => {
    expect(summarizeHours([])).toEqual({ totalHours: 0, weeks: [] });
  });
});
