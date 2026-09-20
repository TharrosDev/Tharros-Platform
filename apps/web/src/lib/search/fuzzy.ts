/**
 * Tiny dependency-free fuzzy matcher for the command palette. Subsequence
 * match: every query character must appear in order in the candidate. Scoring
 * favours word-start hits and consecutive runs so "sch cal" finds
 * "Scheduling calendar" and "inv" ranks "Invite a teammate" above
 * "Conversations".
 *
 * Pure and isomorphic: used by the palette client for static entries and by
 * the search server action for fetched rows.
 */

export type FuzzyResult = {
  /** Higher is better. Comparable only within one query. */
  score: number;
  /** Candidate indices that matched, for highlighting. */
  indices: number[];
};

const WORD_START_BONUS = 8;
const CONSECUTIVE_BONUS = 5;
const FIRST_CHAR_BONUS = 6;
const GAP_PENALTY = 0.5;

function isWordStart(text: string, index: number): boolean {
  if (index === 0) return true;
  const prev = text[index - 1];
  return prev === " " || prev === "-" || prev === "_" || prev === "/" || prev === ".";
}

/**
 * Find `ch` at or after `from`, preferring an occurrence at a word start over
 * the first plain occurrence. Greedy first-occurrence matching would pick the
 * `c` inside "S(c)hedule calendar" for the query "cal"; the word-start
 * preference aligns it with "calendar" instead.
 */
function findChar(text: string, ch: string, from: number): number {
  let i = text.indexOf(ch, from);
  const first = i;
  while (i !== -1) {
    if (isWordStart(text, i)) return i;
    i = text.indexOf(ch, i + 1);
  }
  return first;
}

/** Match `query` against `text`. Returns null when it is not a subsequence. */
export function fuzzyMatch(query: string, text: string): FuzzyResult | null {
  const q = query.trim().toLowerCase();
  if (!q) return { score: 0, indices: [] };
  const t = text.toLowerCase();

  const indices: number[] = [];
  let score = 0;
  let ti = 0;

  for (let qi = 0; qi < q.length; qi++) {
    const ch = q[qi];
    if (ch === " ") continue; // treat spaces as soft separators
    const prev = indices.length ? indices[indices.length - 1] : -1;
    // Mid-run, continue the consecutive streak when possible before hunting
    // for a fresh word start.
    const found = prev !== -1 && t[prev + 1] === ch ? prev + 1 : findChar(t, ch, ti);
    if (found === -1) return null;

    score += 1;
    if (found === 0) score += FIRST_CHAR_BONUS;
    if (isWordStart(t, found)) score += WORD_START_BONUS;
    if (indices.length > 0 && found === indices[indices.length - 1] + 1) {
      score += CONSECUTIVE_BONUS;
    }
    score -= (found - ti) * GAP_PENALTY;

    indices.push(found);
    ti = found + 1;
  }

  // Slightly favour shorter candidates so exact-ish hits rank first.
  score -= t.length * 0.05;
  return { score, indices };
}

/** Filter + rank a list by fuzzy score against `query` (best first). */
export function fuzzyFilter<T>(
  query: string,
  items: T[],
  text: (item: T) => string,
  limit = 8,
): T[] {
  if (!query.trim()) return items.slice(0, limit);
  return items
    .map((item) => ({ item, match: fuzzyMatch(query, text(item)) }))
    .filter((r): r is { item: T; match: FuzzyResult } => r.match !== null)
    .sort((a, b) => b.match.score - a.match.score)
    .slice(0, limit)
    .map((r) => r.item);
}
