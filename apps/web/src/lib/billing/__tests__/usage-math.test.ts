import { describe, expect, it } from "vitest";

import {
  capDecision,
  currentUsagePeriodStart,
  NEAR_LIMIT_THRESHOLD,
  usageBannerState,
} from "../usage-math";

/**
 * Day 33 — pure cap + period math. Provider-free; the DB-touching metering
 * (recordUsage / getMonthlyQueryCount / checkQueryCap) is verified live, not in
 * CI.
 */

describe("capDecision", () => {
  it("allows when under the cap", () => {
    const d = capDecision(10, 500);
    expect(d.allowed).toBe(true);
    expect(d.nearLimit).toBe(false);
    expect(d).toMatchObject({ used: 10, cap: 500 });
  });

  it("hard-blocks at and beyond the cap", () => {
    expect(capDecision(500, 500).allowed).toBe(false);
    expect(capDecision(501, 500).allowed).toBe(false);
  });

  it("flags nearLimit at the 80% threshold (still allowed)", () => {
    const d = capDecision(400, 500); // exactly 80%
    expect(d.allowed).toBe(true);
    expect(d.nearLimit).toBe(true);
    expect(400 / 500).toBe(NEAR_LIMIT_THRESHOLD);
  });

  it("does not flag nearLimit just below the threshold", () => {
    expect(capDecision(399, 500).nearLimit).toBe(false);
  });

  it("blocks everything when the cap is non-positive (no plan/allowance)", () => {
    expect(capDecision(0, 0)).toMatchObject({ allowed: false, nearLimit: false });
    expect(capDecision(5, -1).allowed).toBe(false);
  });
});

describe("usageBannerState (Day 61)", () => {
  it("shows nothing with plenty of headroom", () => {
    expect(usageBannerState(capDecision(10, 500))).toBeNull();
  });

  it("warns at/above the near-limit threshold while still allowed", () => {
    expect(usageBannerState(capDecision(400, 500))).toEqual({ tone: "warning", used: 400, cap: 500 });
    expect(usageBannerState(capDecision(450, 500))?.tone).toBe("warning");
  });

  it("flips to 'reached' once the cap is hit", () => {
    expect(usageBannerState(capDecision(500, 500))).toEqual({ tone: "reached", used: 500, cap: 500 });
    expect(usageBannerState(capDecision(520, 500))?.tone).toBe("reached");
  });

  it("never shows a banner when there is no plan/cap", () => {
    expect(usageBannerState(capDecision(0, 0))).toBeNull();
  });
});

describe("currentUsagePeriodStart", () => {
  it("returns the first instant of the month in UTC", () => {
    const start = currentUsagePeriodStart(new Date("2026-06-17T14:30:00Z"));
    expect(start.toISOString()).toBe("2026-06-01T00:00:00.000Z");
  });

  it("uses UTC even when local-time month would differ", () => {
    // 2026-07-01T00:30Z is still July 1 in UTC.
    const start = currentUsagePeriodStart(new Date("2026-07-01T00:30:00Z"));
    expect(start.toISOString()).toBe("2026-07-01T00:00:00.000Z");
  });

  it("handles January (month rollover boundary)", () => {
    const start = currentUsagePeriodStart(new Date("2026-01-31T23:59:59Z"));
    expect(start.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });
});
