import { describe, expect, it } from "vitest";

import {
  isSameOriginMutation,
  opaqueRateLimitKey,
  readJsonBody,
  requestFingerprint,
} from "../request";

describe("requestFingerprint", () => {
  it("is stable without exposing raw request metadata", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.7, 10.0.0.1",
      "user-agent": "Example Browser",
    });

    const key = requestFingerprint(headers);
    expect(key).toHaveLength(32);
    expect(key).not.toContain("203.0.113.7");
    expect(requestFingerprint(headers)).toBe(key);
  });
});

describe("isSameOriginMutation", () => {
  const url = "https://app.example.test/api/mutation";

  it("accepts Fetch Metadata same-origin requests", () => {
    expect(
      isSameOriginMutation(
        new Request(url, { method: "POST", headers: { "sec-fetch-site": "same-origin" } }),
      ),
    ).toBe(true);
  });

  it("rejects cross-site and same-site mutation requests", () => {
    for (const site of ["cross-site", "same-site", "none"]) {
      expect(
        isSameOriginMutation(
          new Request(url, { method: "POST", headers: { "sec-fetch-site": site } }),
        ),
      ).toBe(false);
    }
  });

  it("falls back to an exact Origin match", () => {
    expect(
      isSameOriginMutation(
        new Request(url, { method: "POST", headers: { origin: "https://app.example.test" } }),
      ),
    ).toBe(true);
    expect(
      isSameOriginMutation(
        new Request(url, { method: "POST", headers: { origin: "https://evil.example" } }),
      ),
    ).toBe(false);
  });

  it("falls back to Referer and rejects missing provenance", () => {
    expect(
      isSameOriginMutation(
        new Request(url, {
          method: "POST",
          headers: { referer: "https://app.example.test/knowledge" },
        }),
      ),
    ).toBe(true);
    expect(isSameOriginMutation(new Request(url, { method: "POST" }))).toBe(false);
  });
});

describe("opaqueRateLimitKey", () => {
  it("does not store the sensitive identifier in the bucket key", () => {
    const key = opaqueRateLimitKey("login-email", "person@example.test");
    expect(key).toMatch(/^login-email:[a-f0-9]{32}$/);
    expect(key).not.toContain("person@example.test");
  });
});

describe("readJsonBody", () => {
  it("parses JSON below the byte ceiling", async () => {
    const result = await readJsonBody<{ ok: boolean }>(
      new Request("https://app.example.test/api", {
        method: "POST",
        body: JSON.stringify({ ok: true }),
      }),
      1024,
    );
    expect(result).toEqual({ ok: true, value: { ok: true } });
  });

  it("rejects oversized and invalid JSON bodies", async () => {
    const oversized = await readJsonBody(
      new Request("https://app.example.test/api", {
        method: "POST",
        body: JSON.stringify({ data: "x".repeat(100) }),
      }),
      32,
    );
    expect(oversized).toEqual({ ok: false, reason: "too_large" });

    const invalid = await readJsonBody(
      new Request("https://app.example.test/api", { method: "POST", body: "{" }),
      1024,
    );
    expect(invalid).toEqual({ ok: false, reason: "invalid_json" });
  });
});
