import { describe, expect, it } from "vitest";

import type { Citation } from "@/lib/documents/rag-prompt";
import {
  citationSetMatch,
  citedDocsFromIndices,
  factHitRate,
  jaccard,
  looksDeclined,
  mean,
  negativeHandled,
  parseCitationIndices,
  precision,
  recall,
  reciprocalRank,
} from "../metrics";

/**
 * Day 34 — pure eval scoring. Provider-free; the live embedding/Claude path is
 * exercised by the gated harness (`rag-eval.live.ts`), not in CI.
 */

const cite = (index: number, filename: string): Citation => ({
  index,
  documentId: `doc-${index}`,
  filename,
  chunkIndices: [0],
});

describe("parseCitationIndices", () => {
  it("extracts unique sorted indices from [n] markers", () => {
    expect(parseCitationIndices("Refunds are 30 days [1]. Also [2][1].")).toEqual([1, 2]);
  });
  it("returns [] when there are no markers", () => {
    expect(parseCitationIndices("no citations here")).toEqual([]);
  });
  it("ignores zero / non-numeric brackets", () => {
    expect(parseCitationIndices("[0] [x] [3]")).toEqual([3]);
  });
});

describe("citedDocsFromIndices", () => {
  it("maps indices to distinct filenames", () => {
    const citations = [cite(1, "refund-policy.md"), cite(2, "pricing.md")];
    expect(citedDocsFromIndices([1, 2], citations)).toEqual(["refund-policy.md", "pricing.md"]);
  });
  it("drops indices with no matching citation", () => {
    expect(citedDocsFromIndices([1, 9], [cite(1, "a.md")])).toEqual(["a.md"]);
  });
});

describe("recall", () => {
  it("is 1 when all expected docs are retrieved", () => {
    expect(recall(["a.md", "b.md", "c.md"], ["a.md"])).toBe(1);
  });
  it("is fractional when some expected docs are missing", () => {
    expect(recall(["a.md"], ["a.md", "b.md"])).toBe(0.5);
  });
  it("is 1 when nothing is expected (negatives)", () => {
    expect(recall([], [])).toBe(1);
  });
  it("is case-insensitive", () => {
    expect(recall(["A.MD"], ["a.md"])).toBe(1);
  });
});

describe("precision", () => {
  it("is 1 when every retrieved doc is expected", () => {
    expect(precision(["a.md"], ["a.md", "b.md"])).toBe(1);
  });
  it("dilutes as irrelevant docs are retrieved", () => {
    expect(precision(["a.md", "b.md", "c.md", "d.md"], ["a.md"])).toBe(0.25);
  });
  it("is 0 for empty retrieval", () => {
    expect(precision([], ["a.md"])).toBe(0);
  });
});

describe("reciprocalRank", () => {
  it("rewards the expected doc ranking first", () => {
    expect(reciprocalRank(["a.md", "b.md"], ["a.md"])).toBe(1);
  });
  it("halves when the expected doc is second", () => {
    expect(reciprocalRank(["b.md", "a.md"], ["a.md"])).toBe(0.5);
  });
  it("is 0 when the expected doc is absent", () => {
    expect(reciprocalRank(["b.md", "c.md"], ["a.md"])).toBe(0);
  });
});

describe("citationSetMatch / jaccard", () => {
  it("matches exactly equal sets", () => {
    expect(citationSetMatch(["a.md"], ["a.md"])).toBe(1);
    expect(citationSetMatch(["a.md", "b.md"], ["a.md"])).toBe(0);
  });
  it("computes jaccard overlap", () => {
    expect(jaccard(["a.md", "b.md"], ["a.md"])).toBe(0.5);
    expect(jaccard([], [])).toBe(1);
  });
});

describe("factHitRate", () => {
  it("counts case-insensitive substring hits", () => {
    expect(factHitRate("The Plus plan is $49 with 10% off", ["$49", "10%"])).toBe(1);
    expect(factHitRate("The Plus plan is $49", ["$49", "10%"])).toBe(0.5);
  });
  it("is 1 when there are no expected facts", () => {
    expect(factHitRate("anything", [])).toBe(1);
  });
});

describe("looksDeclined / negativeHandled", () => {
  it("detects the grounded 'I don't know' shape", () => {
    expect(
      looksDeclined("I couldn't find anything in your uploaded documents that covers this."),
    ).toBe(true);
    expect(looksDeclined("The documents don't cover warranty periods.")).toBe(true);
    expect(looksDeclined("Refunds are 30 days [1].")).toBe(false);
  });
  it("handles a negative only when it declines AND cites nothing", () => {
    expect(negativeHandled("The documents don't cover that.", 0)).toBe(true);
    expect(negativeHandled("The documents don't cover that. [1]", 1)).toBe(false);
    expect(negativeHandled("Refunds are 30 days.", 0)).toBe(false);
  });
});

describe("mean", () => {
  it("averages and handles empty", () => {
    expect(mean([1, 2, 3])).toBe(2);
    expect(mean([])).toBe(0);
  });
});
