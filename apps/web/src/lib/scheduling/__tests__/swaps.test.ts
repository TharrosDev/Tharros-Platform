import { describe, expect, it } from "vitest";

import { defaultLaborRules } from "../presets";
import type { LaborRules, ShiftInput } from "../types";
import type { EligibilityCandidate } from "../replacement";
import { DEFAULT_SWAP_POLICY, resolveSwapPolicy, validateSwap, type SwapShift } from "../swaps";

/**
 * Day 56 — shift-swap pure logic. validateSwap composes the Day-55 eligibility
 * checks for whoever ends up holding each shift (the taker gives up their own shift
 * first). Provider-free, no DB. Timestamps are local-as-UTC ISO strings.
 */

const RULES: LaborRules = {
  ...defaultLaborRules("org-1", "2026-01-01T00:00:00Z"),
  max_daily_hours: 8,
};

// X = Mon Jun 15, 1–5pm (role r1, A's shift). Y = Tue Jun 16, 1–5pm (role r2, B's shift).
const X: SwapShift = {
  id: "x",
  date: "2026-06-15",
  startsAt: "2026-06-15T13:00:00Z",
  endsAt: "2026-06-15T17:00:00Z",
  roleId: "r1",
  breakMinutes: 0,
};
const Y: SwapShift = {
  id: "y",
  date: "2026-06-16",
  startsAt: "2026-06-16T13:00:00Z",
  endsAt: "2026-06-16T17:00:00Z",
  roleId: "r2",
  breakMinutes: 0,
};

const sh = (id: string, employeeId: string, startsAt: string, endsAt: string): ShiftInput => ({
  id,
  employeeId,
  startsAt,
  endsAt,
  breakMinutes: 0,
});

/** A party available all of Jun 15–16, holding the given roles + assigned shifts. */
function party(id: string, roleIds: string[], assignedShifts: ShiftInput[]): EligibilityCandidate {
  return {
    id,
    isMinor: false,
    roleIds,
    permanent: [],
    temporary: [
      {
        id: `t-${id}`,
        effective_date: "2026-06-15",
        end_date: "2026-06-16",
        is_available: true,
        start_time: null,
        end_time: null,
        notes: null,
      },
    ],
    assignedShifts,
  };
}

describe("resolveSwapPolicy", () => {
  it("defaults when unset or malformed", () => {
    expect(resolveSwapPolicy(null)).toEqual(DEFAULT_SWAP_POLICY);
    expect(resolveSwapPolicy("nope")).toEqual(DEFAULT_SWAP_POLICY);
    expect(resolveSwapPolicy({})).toEqual(DEFAULT_SWAP_POLICY);
  });
  it("reads stored values and merges partials", () => {
    expect(resolveSwapPolicy({ autoApproveValid: false })).toEqual({
      autoApproveValid: false,
      escalateInvalid: true,
    });
    expect(resolveSwapPolicy({ autoApproveValid: false, escalateInvalid: false })).toEqual({
      autoApproveValid: false,
      escalateInvalid: false,
    });
  });
});

describe("validateSwap — trade (X<->Y)", () => {
  it("is valid when both parties qualify for, are available for, and have room for the other shift", () => {
    const res = validateSwap({
      shiftX: X,
      shiftY: Y,
      requester: party("A", ["r1", "r2"], [sh("x", "A", X.startsAt, X.endsAt)]),
      claimant: party("B", ["r1", "r2"], [sh("y", "B", Y.startsAt, Y.endsAt)]),
      laborRules: RULES,
    });
    expect(res.valid).toBe(true);
    expect(res.reasons).toEqual([]);
  });

  it("is invalid when the claimant isn't role-qualified for X", () => {
    const res = validateSwap({
      shiftX: X,
      shiftY: Y,
      requester: party("A", ["r1", "r2"], [sh("x", "A", X.startsAt, X.endsAt)]),
      claimant: party("B", ["r2"], [sh("y", "B", Y.startsAt, Y.endsAt)]), // lacks r1
      laborRules: RULES,
    });
    expect(res.valid).toBe(false);
    expect(res.reasons.some((r) => r.includes("B"))).toBe(true);
  });

  it("is invalid when the requester isn't available for Y", () => {
    const a = party("A", ["r1", "r2"], [sh("x", "A", X.startsAt, X.endsAt)]);
    a.temporary = [
      {
        id: "t-A",
        effective_date: "2026-06-15",
        end_date: "2026-06-15",
        is_available: true,
        start_time: null,
        end_time: null,
        notes: null,
      },
    ]; // available Mon only, not Tue (Y)
    const res = validateSwap({
      shiftX: X,
      shiftY: Y,
      requester: a,
      claimant: party("B", ["r1", "r2"], [sh("y", "B", Y.startsAt, Y.endsAt)]),
      laborRules: RULES,
    });
    expect(res.valid).toBe(false);
    expect(res.reasons.some((r) => r.includes("A"))).toBe(true);
  });

  it("is invalid when taking X breaks the claimant's daily-hours limit", () => {
    const res = validateSwap({
      shiftX: X,
      shiftY: Y,
      requester: party("A", ["r1", "r2"], [sh("x", "A", X.startsAt, X.endsAt)]),
      // B already works 6h Mon (same day as X) → +4h = 10h > max_daily 8.
      claimant: party(
        "B",
        ["r1", "r2"],
        [
          sh("y", "B", Y.startsAt, Y.endsAt),
          sh("b-mon", "B", "2026-06-15T05:00:00Z", "2026-06-15T11:00:00Z"),
        ],
      ),
      laborRules: RULES,
    });
    expect(res.valid).toBe(false);
  });
});

describe("validateSwap — handoff / open offer (no Y)", () => {
  it("only checks the claimant taking X", () => {
    const res = validateSwap({
      shiftX: X,
      shiftY: null,
      requester: party("A", ["r1"], [sh("x", "A", X.startsAt, X.endsAt)]),
      claimant: party("B", ["r1"], []),
      laborRules: RULES,
    });
    expect(res.valid).toBe(true);
  });

  it("rejects a handoff when the claimant can't take X", () => {
    const res = validateSwap({
      shiftX: X,
      shiftY: null,
      requester: party("A", ["r1"], [sh("x", "A", X.startsAt, X.endsAt)]),
      claimant: party("B", [], []), // not role-qualified for X
      laborRules: RULES,
    });
    expect(res.valid).toBe(false);
  });
});
