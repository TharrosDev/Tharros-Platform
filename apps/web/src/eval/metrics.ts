import type { Citation } from "@/lib/documents/rag-prompt";

/**
 * Day 34 — pure scoring helpers for the RAG eval harness. No I/O, no providers,
 * no `server-only`, so they're unit-testable in CI. The harness (`rag-eval.live.ts`)
 * does the embedding/Claude calls and feeds the resulting per-question facts in
 * here.
 */

/** Parse inline `[n]` citation markers from an answer → unique 1-based indices. */
export function parseCitationIndices(answer: string): number[] {
  const seen = new Set<number>();
  for (const m of answer.matchAll(/\[(\d+)\]/g)) {
    const n = Number(m[1]);
    if (Number.isInteger(n) && n > 0) seen.add(n);
  }
  return [...seen].sort((a, b) => a - b);
}

/** Map parsed citation indices → the distinct document filenames they point at. */
export function citedDocsFromIndices(indices: number[], citations: Citation[]): string[] {
  const byIndex = new Map(citations.map((c) => [c.index, c.filename]));
  const docs = new Set<string>();
  for (const i of indices) {
    const filename = byIndex.get(i);
    if (filename) docs.add(filename);
  }
  return [...docs];
}

const norm = (s: string) => s.toLowerCase();
const intersectionSize = (a: Set<string>, b: Iterable<string>) => {
  let n = 0;
  for (const x of b) if (a.has(x)) n++;
  return n;
};

/**
 * Recall: fraction of the expected docs that appear among the retrieved docs.
 * Returns 1 when nothing is expected (vacuously complete).
 */
export function recall(retrievedDocs: string[], expectedDocs: string[]): number {
  if (expectedDocs.length === 0) return 1;
  const retrieved = new Set(retrievedDocs.map(norm));
  return intersectionSize(retrieved, expectedDocs.map(norm)) / expectedDocs.length;
}

/** Precision: fraction of retrieved docs that are expected. Empty retrieval → 0. */
export function precision(retrievedDocs: string[], expectedDocs: string[]): number {
  if (retrievedDocs.length === 0) return 0;
  const expected = new Set(expectedDocs.map(norm));
  const retrievedUnique = [...new Set(retrievedDocs.map(norm))];
  return intersectionSize(expected, retrievedUnique) / retrievedUnique.length;
}

/** Reciprocal rank of the first expected doc in the retrieved order (0 if none). */
export function reciprocalRank(retrievedDocs: string[], expectedDocs: string[]): number {
  if (expectedDocs.length === 0) return 1;
  const expected = new Set(expectedDocs.map(norm));
  const seen = new Set<string>();
  let rank = 0;
  for (const d of retrievedDocs.map(norm)) {
    if (seen.has(d)) continue;
    seen.add(d);
    rank++;
    if (expected.has(d)) return 1 / rank;
  }
  return 0;
}

/** Exact set-equality of cited docs vs expected docs → 1 or 0. */
export function citationSetMatch(citedDocs: string[], expectedDocs: string[]): number {
  const cited = new Set(citedDocs.map(norm));
  const expected = new Set(expectedDocs.map(norm));
  if (cited.size !== expected.size) return 0;
  for (const d of expected) if (!cited.has(d)) return 0;
  return 1;
}

/** Jaccard overlap of cited vs expected docs. Both empty → 1. */
export function jaccard(citedDocs: string[], expectedDocs: string[]): number {
  const a = new Set(citedDocs.map(norm));
  const b = new Set(expectedDocs.map(norm));
  if (a.size === 0 && b.size === 0) return 1;
  const inter = intersectionSize(a, b);
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : inter / union;
}

/** Fraction of expected facts present as case-insensitive substrings. Empty → 1. */
export function factHitRate(answer: string, expectedFacts: string[]): number {
  if (expectedFacts.length === 0) return 1;
  const hay = norm(answer);
  const hits = expectedFacts.filter((f) => hay.includes(norm(f))).length;
  return hits / expectedFacts.length;
}

/**
 * Heuristic: does the answer decline to answer (the grounded "I don't know"
 * shape)? Used to score out-of-corpus negatives.
 */
export function looksDeclined(answer: string): boolean {
  const a = norm(answer);
  return (
    /\bdon'?t (?:have|know|cover)\b/.test(a) ||
    /\bcouldn'?t find\b/.test(a) ||
    /\b(?:do|does)(?:n'?t| not) (?:cover|contain|include|mention)\b/.test(a) ||
    /\b(?:isn'?t|aren'?t|not) (?:covered|mentioned|included|available|specified)\b/.test(a) ||
    /\bno (?:information|details|mention)\b/.test(a) ||
    /\buploaded documents\b/.test(a)
  );
}

/** A negative is handled when the answer declines AND cites nothing. */
export function negativeHandled(answer: string, citedDocCount: number): boolean {
  return looksDeclined(answer) && citedDocCount === 0;
}

export function mean(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}
