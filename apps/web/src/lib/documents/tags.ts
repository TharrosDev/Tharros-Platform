/**
 * Day 32 — pure helpers for document tags + library search. Kept free of
 * `server-only` and any I/O so they're unit-testable and shared by the client
 * (tag editor, search box) and the server action (re-normalize before write).
 */

/** Max tags per document, and max length of a single tag. */
export const MAX_TAGS = 12;
export const MAX_TAG_LENGTH = 32;

/**
 * Normalize a single tag: trim, collapse inner whitespace, lowercase, cap length.
 * Returns `""` for anything with no usable characters (caller drops empties).
 */
export function normalizeTag(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .slice(0, MAX_TAG_LENGTH)
    .trim();
}

/**
 * Normalize a list of tags: normalize each, drop empties, de-duplicate
 * (first-seen order), and cap at `MAX_TAGS`. The single source of truth for what
 * a valid tag set looks like — applied on the client and re-applied server-side.
 */
export function normalizeTags(raw: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of raw) {
    const tag = normalizeTag(t);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

/**
 * Does a document match a free-text library query? Matches against the filename
 * and any tag, case-insensitively. An empty/blank query matches everything.
 */
export function matchesQuery(
  doc: { filename: string; tags: string[] },
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (doc.filename.toLowerCase().includes(q)) return true;
  return doc.tags.some((t) => t.toLowerCase().includes(q));
}
