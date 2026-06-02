import { decode, encode } from "gpt-tokenizer/encoding/cl100k_base";

/**
 * Day 26 — token-aware chunking. Splits extracted text into overlapping,
 * token-bounded chunks for embedding. cl100k_base is text-embedding-3-small's
 * tokenizer, so the counts here match what OpenAI bills + caps on (8191/req).
 *
 * Pure + dependency-light (gpt-tokenizer is plain JS) so it's unit-testable and
 * safe to import anywhere — no secrets, no network.
 */

export type Chunk = {
  index: number;
  content: string;
  tokenCount: number;
};

export type ChunkOptions = {
  /** Target tokens per chunk. Comfortably under the 8191/req embedding cap and
   * small enough that retrieved context stays focused. */
  maxTokens?: number;
  /** Tokens of overlap between consecutive chunks, so a fact split across a
   * boundary still appears whole in at least one chunk. */
  overlapTokens?: number;
};

const DEFAULT_MAX_TOKENS = 500;
const DEFAULT_OVERLAP_TOKENS = 80;

/** Split `text` into overlapping token-bounded chunks. Empty/blank → []. */
export function chunkText(text: string, options: ChunkOptions = {}): Chunk[] {
  const maxTokens = Math.max(1, options.maxTokens ?? DEFAULT_MAX_TOKENS);
  const overlapTokens = Math.min(
    Math.max(0, options.overlapTokens ?? DEFAULT_OVERLAP_TOKENS),
    maxTokens - 1, // overlap must be < maxTokens or the window never advances
  );

  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (normalized.length === 0) return [];

  const tokens = encode(normalized);
  if (tokens.length <= maxTokens) {
    return [{ index: 0, content: normalized, tokenCount: tokens.length }];
  }

  const step = maxTokens - overlapTokens;
  const chunks: Chunk[] = [];
  let index = 0;
  for (let start = 0; start < tokens.length; start += step) {
    const slice = tokens.slice(start, start + maxTokens);
    const content = decode(slice).trim();
    if (content.length > 0) {
      chunks.push({ index: index++, content, tokenCount: slice.length });
    }
    if (start + maxTokens >= tokens.length) break; // last window covered the tail
  }
  return chunks;
}
