import { describe, expect, it } from "vitest";

import {
  buildCitations,
  buildContextBlock,
  NO_CONTEXT_ANSWER,
  type GroundingChunk,
} from "@/lib/documents/rag-prompt";

function chunk(over: Partial<GroundingChunk> = {}): GroundingChunk {
  return {
    id: over.id ?? "chunk-1",
    documentId: over.documentId ?? "doc-1",
    chunkIndex: over.chunkIndex ?? 0,
    content: over.content ?? "Some text.",
    similarity: over.similarity ?? 0.9,
    filename: over.filename ?? "handbook.pdf",
  };
}

describe("buildContextBlock", () => {
  it("heads each document with its numbered source label and filename", () => {
    const block = buildContextBlock([
      chunk({ filename: "handbook.pdf", chunkIndex: 3, content: "Vacation is 20 days." }),
    ]);
    expect(block).toContain("SOURCES:");
    expect(block).toContain("[1] handbook.pdf");
    expect(block).toContain("Vacation is 20 days.");
  });

  it("numbers distinct documents 1..N in first-seen order and groups their chunks", () => {
    const block = buildContextBlock([
      chunk({ id: "a", documentId: "doc-1", filename: "a.pdf", content: "FIRST" }),
      chunk({ id: "b", documentId: "doc-2", filename: "b.pdf", content: "SECOND" }),
      chunk({ id: "c", documentId: "doc-1", filename: "a.pdf", content: "FIRST-TWO" }),
    ]);
    expect(block).toContain("[1] a.pdf");
    expect(block).toContain("[2] b.pdf");
    // doc-1's two chunks group under [1], before doc-2.
    expect(block.indexOf("FIRST-TWO")).toBeLessThan(block.indexOf("SECOND"));
  });

  it("trims chunk content", () => {
    const block = buildContextBlock([chunk({ content: "  padded  \n" })]);
    expect(block).toContain("padded");
    expect(block).not.toContain("  padded  ");
  });
});

describe("buildCitations", () => {
  it("returns one indexed citation per document with sorted, de-duped chunk indices", () => {
    const citations = buildCitations([
      chunk({ documentId: "doc-1", filename: "a.pdf", chunkIndex: 2 }),
      chunk({ documentId: "doc-1", filename: "a.pdf", chunkIndex: 0 }),
      chunk({ documentId: "doc-1", filename: "a.pdf", chunkIndex: 2 }), // dupe index
    ]);
    expect(citations).toHaveLength(1);
    expect(citations[0]).toEqual({
      index: 1,
      documentId: "doc-1",
      filename: "a.pdf",
      chunkIndices: [0, 2],
    });
  });

  it("numbers documents in first-seen order, matching the SOURCES block", () => {
    const citations = buildCitations([
      chunk({ documentId: "doc-2", filename: "b.pdf", chunkIndex: 1 }),
      chunk({ documentId: "doc-1", filename: "a.pdf", chunkIndex: 0 }),
      chunk({ documentId: "doc-2", filename: "b.pdf", chunkIndex: 4 }),
    ]);
    expect(citations.map((c) => [c.index, c.documentId])).toEqual([
      [1, "doc-2"],
      [2, "doc-1"],
    ]);
    expect(citations[0].chunkIndices).toEqual([1, 4]);
  });

  it("returns [] for no chunks", () => {
    expect(buildCitations([])).toEqual([]);
  });
});

describe("NO_CONTEXT_ANSWER", () => {
  it("is a non-empty user-facing string", () => {
    expect(NO_CONTEXT_ANSWER.length).toBeGreaterThan(0);
  });
});
