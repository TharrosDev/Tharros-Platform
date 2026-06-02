import type { RetrievedChunk } from "@/lib/documents/retrieval";

/**
 * Day 28 — pure prompt-assembly for the RAG query pipeline. This module is
 * deliberately free of `server-only`, the Anthropic SDK, and any I/O so it can
 * be unit-tested directly (mirrors `extract.ts`/`chunk.ts`). The orchestration
 * that actually retrieves chunks and calls Claude lives in `rag.ts`.
 */

/** A retrieved chunk joined to its document's filename, for grounding + citing. */
export type GroundingChunk = RetrievedChunk & { filename: string };

/** A document the answer drew from, with the chunk positions that were used. */
export type Citation = {
  documentId: string;
  filename: string;
  /** Chunk indices (within the document) that were supplied as context. */
  chunkIndices: number[];
};

/**
 * Grounding instructions for the assistant. Phrased as rules/context (not
 * override commands) — Opus 4.8 follows literal instructions well, so the
 * "only use the sources / say you don't know" contract is stated plainly.
 */
export const SYSTEM_PROMPT = `You are the Tharros business assistant. You answer questions strictly from the SOURCES the user provides below — internal documents a business has uploaded.

Rules:
- Use ONLY the information in the provided sources. Do not rely on outside or general knowledge.
- Cite the source filename(s) you used, inline, in parentheses — e.g. (handbook.pdf). Cite every claim you make.
- If the sources do not contain enough information to answer, say so plainly: state that the uploaded documents don't cover it. Do not guess, speculate, or fill gaps from general knowledge.
- Be concise and direct. Quote short phrases from the sources when it helps precision.`;

/** Returned (without calling Claude) when retrieval finds no relevant chunks. */
export const NO_CONTEXT_ANSWER =
  "I couldn't find anything in your uploaded documents that covers this. Try rephrasing the question, or upload a document that contains the answer.";

/**
 * Render retrieved chunks as a single labeled context string. Each chunk is
 * tagged with its source filename and in-document index so the model can cite
 * by filename. Order is preserved (the RPC already returns best-match first).
 */
export function buildContextBlock(chunks: GroundingChunk[]): string {
  const sources = chunks
    .map(
      (c, i) =>
        `[${i + 1}] (source: ${c.filename} #${c.chunkIndex})\n${c.content.trim()}`,
    )
    .join("\n\n");

  return `SOURCES:\n\n${sources}`;
}

/**
 * Collapse the grounding chunks into one citation per document, gathering the
 * chunk indices used. First-seen document order is preserved; indices are
 * de-duplicated and sorted ascending for stable output.
 */
export function buildCitations(chunks: GroundingChunk[]): Citation[] {
  const byDoc = new Map<string, Citation>();

  for (const c of chunks) {
    const existing = byDoc.get(c.documentId);
    if (existing) {
      if (!existing.chunkIndices.includes(c.chunkIndex)) {
        existing.chunkIndices.push(c.chunkIndex);
      }
    } else {
      byDoc.set(c.documentId, {
        documentId: c.documentId,
        filename: c.filename,
        chunkIndices: [c.chunkIndex],
      });
    }
  }

  for (const citation of byDoc.values()) {
    citation.chunkIndices.sort((a, b) => a - b);
  }

  return [...byDoc.values()];
}
