import { describe, expect, it } from "vitest";

import {
  fetchPublicPage,
  importFilename,
  isPublicAddress,
  pageToText,
  parseImportUrl,
} from "@/lib/documents/url-import";

describe("isPublicAddress", () => {
  it("rejects private, loopback, link-local, CGNAT and metadata addresses", () => {
    for (const ip of [
      "10.1.2.3",
      "127.0.0.1",
      "169.254.169.254",
      "172.16.0.1",
      "192.168.1.1",
      "100.64.0.1",
      "0.0.0.0",
      "::1",
      "fd00::1",
      "fe80::1",
      "::ffff:127.0.0.1",
      "not-an-ip",
    ]) {
      expect(isPublicAddress(ip), ip).toBe(false);
    }
  });

  it("accepts public unicast addresses", () => {
    expect(isPublicAddress("93.184.216.34")).toBe(true);
    expect(isPublicAddress("2606:4700::1111")).toBe(true);
  });
});

describe("parseImportUrl", () => {
  it("accepts a normal https page", () => {
    expect(parseImportUrl("https://example.com/policy")).toBeInstanceOf(URL);
  });

  it.each([
    ["http://example.com", /https/],
    ["https://user:pw@example.com", /credentials/],
    ["https://example.com:8443/", /ports/],
    ["https://127.0.0.1/", /publicly/],
    ["https://[::1]/", /publicly/],
    ["not a url", /full web address/],
  ])("rejects %s", (raw, message) => {
    const res = parseImportUrl(raw);
    expect(res).not.toBeInstanceOf(URL);
    expect((res as { error: string }).error).toMatch(message);
  });
});

describe("fetchPublicPage", () => {
  it("blocks a hostname that resolves to loopback at connect time", async () => {
    await expect(fetchPublicPage(new URL("https://localhost/"))).rejects.toThrow(/non-public/);
  });
});

describe("pageToText / importFilename", () => {
  it("drops nav, images and link targets but keeps content", () => {
    const text = pageToText(
      `<nav>Menu</nav><h1>Refunds</h1><p>Within <a href="/x">30 days</a>.</p><img src="a.png">`,
      "text/html; charset=utf-8",
    );
    expect(text).not.toMatch(/Menu|a\.png|\/x/);
    expect(text).toMatch(/REFUNDS/);
    expect(text).toMatch(/Within 30 days\./);
  });

  it("builds a readable filename", () => {
    expect(importFilename(new URL("https://acme.ca/policies/refunds/"))).toBe(
      "acme.ca-policies-refunds.md",
    );
  });
});
