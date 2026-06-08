import { describe, expect, it } from "vitest";

import { defaultLaborRules } from "../presets";
import type { LaborRules } from "../types";
import {
  DEFAULT_REPLACEMENT_POLICY,
  findEligibleEmployees,
  resolveReplacementPolicy,
  type EligibilityCandidate,
  type OpenShift,
} from "../replacement";

/**
 * Day 55 — replacement engine pure logic. Provider-free, no DB: the eligibility
 * filter composes the existing role / Day-44 availability / Day-42 labor checks, and
 * the policy resolver guards the org config. The DB orchestration (`openReplacement`,
 * `acceptOffer`, `escalateReplacement`) + the atomic RPC are covered by the live
 * `replacement.db.test.ts` harness.
 *
 * Timestamps are local-as-UTC ISO strings (the project-wide convention), so test
 * inputs carry an explicit `Z`.
 */

const RULES: LaborRules = { ...defaultLaborRules("org-1", "2026-01-01T00:00:00Z"), max_daily_hours: 8 };

// A 4-hour open shift on Mon Jun 15, 1–5pm.
const SHIFT: OpenShift = {
  id: "shift-open",
  date: "2026-06-15",
  startsAt: "2026-06-15T13:00:00Z",
  endsAt: "2026-06-15T17:00:00Z",
  roleId: "role-barista",
  breakMinutes: 0,
};

/** A candidate available the whole shift day, qualified, with no other shifts. */
function candidate(overrides: Partial<EligibilityCandidate> = {}): EligibilityCandidate {
  return {
    id: "emp-1",
    isMinor: false,
    roleIds: ["role-barista"],
    permanent: [],
    temporary: [
      {
        id: "t1",
        effective_date: "2026-06-15",
        end_date: "2026-06-15",
        is_available: true,
        start_time: null, // whole day
        end_time: null,
        notes: null,
      },
    ],
    assignedShifts: [],
    ...overrides,
  };
}

describe("resolveReplacementPolicy", () => {
  it("defaults when unset or malformed", () => {
    expect(resolveReplacementPolicy(null)).toEqual(DEFAULT_REPLACEMENT_POLICY);
    expect(resolveReplacementPolicy(undefined)).toEqual(DEFAULT_REPLACEMENT_POLICY);
    expect(resolveReplacementPolicy("nope")).toEqual(DEFAULT_REPLACEMENT_POLICY);
    expect(resolveReplacementPolicy({ timeoutMinutes: -5 })).toEqual(DEFAULT_REPLACEMENT_POLICY);
    expect(resolveReplacementPolicy({ timeoutMinutes: "120" })).toEqual(DEFAULT_REPLACEMENT_POLICY);
  });

  it("reads a stored policy and merges partials", () => {
    expect(resolveReplacementPolicy({ timeoutMinutes: 30, escalateToManager: false })).toEqual({
      timeoutMinutes: 30,
      escalateToManager: false,
    });
    expect(resolveReplacementPolicy({ timeoutMinutes: 240 })).toEqual({
      timeoutMinutes: 240,
      escalateToManager: true,
    });
  });
});

describe("findEligibleEmployees", () => {
  it("includes a qualified, available, free employee", () => {
    const res = findEligibleEmployees({ shift: SHIFT, candidates: [candidate()], laborRules: RULES });
    expect(res.eligible).toEqual(["emp-1"]);
    expect(res.rejected).toEqual([]);
  });

  it("excludes the employee who called out", () => {
    const res = findEligibleEmployees({
      shift: SHIFT,
      candidates: [candidate()],
      laborRules: RULES,
      excludeEmployeeId: "emp-1",
    });
    expect(res.eligible).toEqual([]);
    expect(res.rejected[0]).toMatchObject({ employeeId: "emp-1", reason: "called out of this shift" });
  });

  it("rejects an employee who lacks the required role", () => {
    const res = findEligibleEmployees({
      shift: SHIFT,
      candidates: [candidate({ roleIds: ["role-other"] })],
      laborRules: RULES,
    });
    expect(res.eligible).toEqual([]);
    expect(res.rejected[0].reason).toBe("not role-qualified");
  });

  it("treats a null roleId shift as open to anyone", () => {
    const res = findEligibleEmployees({
      shift: { ...SHIFT, roleId: null },
      candidates: [candidate({ roleIds: [] })],
      laborRules: RULES,
    });
    expect(res.eligible).toEqual(["emp-1"]);
  });

  it("rejects an employee not available that day", () => {
    const res = findEligibleEmployees({
      shift: SHIFT,
      candidates: [candidate({ temporary: [] })], // no availability declared
      laborRules: RULES,
    });
    expect(res.eligible).toEqual([]);
    expect(res.rejected[0].reason).toBe("not available");
  });

  it("rejects an employee already scheduled over the window", () => {
    const res = findEligibleEmployees({
      shift: SHIFT,
      candidates: [
        candidate({
          assignedShifts: [
            { id: "s9", employeeId: "emp-1", startsAt: "2026-06-15T12:00:00Z", endsAt: "2026-06-15T16:00:00Z", breakMinutes: 0 },
          ],
        }),
      ],
      laborRules: RULES,
    });
    expect(res.eligible).toEqual([]);
    expect(res.rejected[0].reason).toBe("already scheduled then");
  });

  it("rejects when adding the shift breaks a hard labor rule", () => {
    // 6h earlier same-day shift + this 4h shift = 10h > max_daily_hours (8).
    const res = findEligibleEmployees({
      shift: SHIFT,
      candidates: [
        candidate({
          assignedShifts: [
            { id: "s-am", employeeId: "emp-1", startsAt: "2026-06-15T05:00:00Z", endsAt: "2026-06-15T11:00:00Z", breakMinutes: 0 },
          ],
        }),
      ],
      laborRules: RULES,
    });
    expect(res.eligible).toEqual([]);
    expect(res.rejected[0].employeeId).toBe("emp-1");
  });

  it("partitions a mixed pool", () => {
    const res = findEligibleEmployees({
      shift: SHIFT,
      candidates: [
        candidate({ id: "ok-1" }),
        candidate({ id: "no-role", roleIds: [] }),
        candidate({ id: "ok-2" }),
      ],
      laborRules: RULES,
    });
    expect(res.eligible.sort()).toEqual(["ok-1", "ok-2"]);
    expect(res.rejected.map((r) => r.employeeId)).toEqual(["no-role"]);
  });
});
