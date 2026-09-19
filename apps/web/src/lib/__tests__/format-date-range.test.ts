import { describe, expect, it } from "vitest";

import { formatDateRange } from "@/lib/utils";

describe("formatDateRange", () => {
  it("collapses the month within one month", () => {
    expect(formatDateRange("2026-09-14", "2026-09-20")).toBe("Sep 14 – 20");
  });
  it("names both months across a month boundary", () => {
    expect(formatDateRange("2026-09-28", "2026-10-04")).toBe("Sep 28 – Oct 4");
  });
  it("adds years across a year boundary", () => {
    expect(formatDateRange("2026-12-28", "2027-01-03")).toBe("Dec 28, 2026 – Jan 3, 2027");
  });
});
