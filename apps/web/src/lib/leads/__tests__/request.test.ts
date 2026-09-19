import { describe, expect, it } from "vitest";

import { leadCaptureRequesterKey } from "../request";

describe("leadCaptureRequesterKey", () => {
  it("is stable for the same request metadata without exposing the raw address", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.7, 10.0.0.1",
      "user-agent": "Example Browser",
    });

    const key = leadCaptureRequesterKey(headers);
    expect(key).toHaveLength(32);
    expect(key).not.toContain("203.0.113.7");
    expect(leadCaptureRequesterKey(headers)).toBe(key);
  });

  it("uses the first forwarded address so proxy chains remain stable", () => {
    const a = new Headers({
      "x-forwarded-for": "203.0.113.7, 10.0.0.1",
      "user-agent": "Example Browser",
    });
    const b = new Headers({
      "x-forwarded-for": "203.0.113.7, 10.0.0.2",
      "user-agent": "Example Browser",
    });

    expect(leadCaptureRequesterKey(a)).toBe(leadCaptureRequesterKey(b));
  });
});
