import { describe, expect, it } from "vitest";

import {
  matchesQuery,
  MAX_TAGS,
  MAX_TAG_LENGTH,
  normalizeTag,
  normalizeTags,
} from "@/lib/documents/tags";

describe("normalizeTag", () => {
  it("trims, collapses whitespace, and lowercases", () => {
    expect(normalizeTag("  HR  Policy ")).toBe("hr policy");
  });

  it("caps length and re-trims", () => {
    const long = "a".repeat(MAX_TAG_LENGTH + 10);
    expect(normalizeTag(long)).toHaveLength(MAX_TAG_LENGTH);
  });

  it("returns empty for whitespace-only input", () => {
    expect(normalizeTag("   ")).toBe("");
  });
});

describe("normalizeTags", () => {
  it("drops empties and de-duplicates case-insensitively, preserving order", () => {
    expect(normalizeTags(["Refunds", "refunds", "  ", "HR"])).toEqual(["refunds", "hr"]);
  });

  it("caps the set at MAX_TAGS", () => {
    const many = Array.from({ length: MAX_TAGS + 5 }, (_, i) => `t${i}`);
    expect(normalizeTags(many)).toHaveLength(MAX_TAGS);
  });
});

describe("matchesQuery", () => {
  const doc = { filename: "Refund-Policy.pdf", tags: ["hr", "returns"] };

  it("matches everything on a blank query", () => {
    expect(matchesQuery(doc, "")).toBe(true);
    expect(matchesQuery(doc, "   ")).toBe(true);
  });

  it("matches on filename substring, case-insensitively", () => {
    expect(matchesQuery(doc, "refund")).toBe(true);
    expect(matchesQuery(doc, "POLICY")).toBe(true);
  });

  it("matches on a tag", () => {
    expect(matchesQuery(doc, "returns")).toBe(true);
  });

  it("does not match unrelated text", () => {
    expect(matchesQuery(doc, "invoice")).toBe(false);
  });
});
