import { describe, expect, it } from "vitest";

import { backoffSeconds, nextRunAt } from "@/lib/jobs/backoff";

describe("backoff", () => {
  it("is 60s after the first failed attempt", () => {
    expect(backoffSeconds(1)).toBe(60);
  });

  it("doubles each subsequent attempt", () => {
    expect(backoffSeconds(2)).toBe(120);
    expect(backoffSeconds(3)).toBe(240);
    expect(backoffSeconds(4)).toBe(480);
  });

  it("caps at one hour", () => {
    expect(backoffSeconds(20)).toBe(3600);
  });

  it("treats 0 like the first attempt", () => {
    expect(backoffSeconds(0)).toBe(60);
  });

  it("nextRunAt adds the backoff to `from`", () => {
    const from = new Date("2026-06-08T00:00:00.000Z");
    expect(nextRunAt(1, from)).toBe("2026-06-08T00:01:00.000Z");
    expect(nextRunAt(2, from)).toBe("2026-06-08T00:02:00.000Z");
  });
});
