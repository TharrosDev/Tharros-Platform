import { describe, expect, it } from "vitest";

import { SUBSCRIPTION_STATUSES } from "../schemas";
import { statusBadgeVariant, statusLabel } from "../status";

/** Day 20 — presentation helper coverage for every subscription status. */

describe("status helpers", () => {
  it("labels every status with a non-empty string", () => {
    for (const s of SUBSCRIPTION_STATUSES) {
      expect(statusLabel(s)).toBeTruthy();
    }
  });

  it("maps the access-granting states to positive variants", () => {
    expect(statusBadgeVariant("active")).toBe("success");
    expect(statusBadgeVariant("trialing")).toBe("info");
  });

  it("maps payment-problem states to destructive", () => {
    expect(statusBadgeVariant("past_due")).toBe("destructive");
    expect(statusBadgeVariant("unpaid")).toBe("destructive");
  });

  it("maps terminal/other states to secondary", () => {
    for (const s of ["canceled", "incomplete", "incomplete_expired", "paused"] as const) {
      expect(statusBadgeVariant(s)).toBe("secondary");
    }
  });
});
