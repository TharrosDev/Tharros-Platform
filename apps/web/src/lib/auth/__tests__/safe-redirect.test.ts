import { describe, expect, it } from "vitest";

import { sanitizeNext } from "../safe-redirect";

describe("sanitizeNext", () => {
  it("accepts same-origin relative paths", () => {
    expect(sanitizeNext("/dashboard")).toBe("/dashboard");
    expect(sanitizeNext("/invite/accept?token=abc")).toBe("/invite/accept?token=abc");
    expect(sanitizeNext("/")).toBe("/");
  });

  it("rejects protocol-relative and backslash redirect tricks", () => {
    expect(sanitizeNext("//evil.com")).toBeUndefined();
    expect(sanitizeNext("//evil.com/path")).toBeUndefined();
    expect(sanitizeNext("/\\evil.com")).toBeUndefined();
    expect(sanitizeNext("/%5cevil.com")).toBeUndefined();
  });

  it("rejects absolute URLs and other schemes", () => {
    expect(sanitizeNext("https://evil.com")).toBeUndefined();
    expect(sanitizeNext("http://evil.com")).toBeUndefined();
    expect(sanitizeNext("javascript:alert(1)")).toBeUndefined();
    expect(sanitizeNext("mailto:a@b.c")).toBeUndefined();
  });

  it("rejects empty, non-path, and control-character input", () => {
    expect(sanitizeNext("")).toBeUndefined();
    expect(sanitizeNext("dashboard")).toBeUndefined();
    expect(sanitizeNext("/dashboard\r\nLocation: https://evil.com")).toBeUndefined();
  });
});
