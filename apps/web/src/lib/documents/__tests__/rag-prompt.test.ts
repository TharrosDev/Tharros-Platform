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
  it("labels each chunk with its source filename and in-document index", () => {
    const block = buildContextBlock([
      chunk({ filename: "handbook.pdf", chunkIndex: 3, content: "Vacation is 20 days." }),
    ]);
    expect(block).toContain("SOURCES:");
    expect(block).toContain("(source: handbook.pdf #3)");
    expect(block).toContain("Vacation is 20 days.");
  });

  it("preserves the order it receives (best-match-first from the RPC)", () => {
    const block = buildContextBlock([
      chunk({ id: "a", content: "FIRST", chunkIndex: 0 }),
      chunk({ id: "b", content: "SECOND", chunkIndex: 1 }),
    ]);
    expect(block.indexOf("FIRST")).toBeLessThan(block.indexOf("SECOND"));
    expect(block).toContain("[1]");
    expect(block).toContain("[2]");
  });

  it("trims chunk content", () => {
    const block = buildContextBlock([chunk({ content: "  padded  \n" })]);
    expect(block).toContain("padded");
    expect(block).not.toContain("  padded  ");
  });
});

describe("buildCitations", () => {
  it("returns one citation per document with sorted, de-duped chunk indices", () => {
    const citations = buildCitations([
      chunk({ documentId: "doc-1", filename: "a.pdf", chunkIndex: 2 }),
      chunk({ documentId: "doc-1", filename: "a.pdf", chunkIndex: 0 }),
      chunk({ documentId: "doc-1", filename: "a.pdf", chunkIndex: 2 }), // dupe index
    ]);
    expect(citations).toHaveLength(1);
    expect(citations[0]).toEqual({
      documentId: "doc-1",
      filename: "a.pdf",
      chunkIndices: [0, 2],
    });
  });

  it("preserves first-seen document order across multiple documents", () => {
    const citations = buildCitations([
      chunk({ documentId: "doc-2", filename: "b.pdf", chunkIndex: 1 }),
      chunk({ documentId: "doc-1", filename: "a.pdf", chunkIndex: 0 }),
      chunk({ documentId: "doc-2", filename: "b.pdf", chunkIndex: 4 }),
    ]);
    expect(citations.map((c) => c.documentId)).toEqual(["doc-2", "doc-1"]);
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
