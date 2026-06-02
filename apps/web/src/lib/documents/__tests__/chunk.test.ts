import { describe, expect, it } from "vitest";

import { chunkText } from "@/lib/documents/chunk";

describe("chunkText", () => {
  it("returns [] for empty or blank text", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   \n  ")).toEqual([]);
  });

  it("keeps short text as a single chunk with a real token count", () => {
    const chunks = chunkText("Hello Tharros, this is a short document.");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].index).toBe(0);
    expect(chunks[0].content).toMatch(/Hello Tharros/);
    expect(chunks[0].tokenCount).toBeGreaterThan(0);
  });

  it("splits long text into multiple sequential, token-bounded chunks", () => {
    const long = "word ".repeat(2000); // ~2000 tokens, well over the default 500
    const chunks = chunkText(long, { maxTokens: 100, overlapTokens: 20 });
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((c, i) => {
      expect(c.index).toBe(i);
      expect(c.tokenCount).toBeLessThanOrEqual(100);
      expect(c.content.length).toBeGreaterThan(0);
    });
  });

  it("overlaps consecutive chunks (the tail of one reappears in the next)", () => {
    // Distinct words so we can see the overlap region directly.
    const words = Array.from({ length: 300 }, (_, i) => `token${i}`).join(" ");
    const chunks = chunkText(words, { maxTokens: 60, overlapTokens: 20 });
    expect(chunks.length).toBeGreaterThan(1);
    // With overlap > 0, the last word of chunk[0] sits inside chunk[1]'s window.
    const lastWordOfFirst = chunks[0].content.trim().split(/\s+/).at(-1)!;
    expect(chunks[1].content).toContain(lastWordOfFirst);
  });

  it("clamps overlap below maxTokens so the window always advances", () => {
    const long = "alpha beta gamma ".repeat(200);
    const chunks = chunkText(long, { maxTokens: 50, overlapTokens: 999 });
    // Would infinite-loop if overlap weren't clamped; assert it terminates + covers.
    expect(chunks.length).toBeGreaterThan(1);
  });
});
