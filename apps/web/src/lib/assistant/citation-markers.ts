/**
 * Day 30 — pure tokenizer for inline citation markers. Splits assistant text on
 * `[n]` bracket-number markers (the citation scheme from `rag-prompt`'s
 * SYSTEM_PROMPT) into text + cite segments. No React / no I/O, so it's unit
 * tested directly and reused by the markdown remark plugin.
 *
 * Adjacent runs like `[1][2]` yield two separate `cite` segments. A non-numeric
 * bracket like `[a]` is left as literal text.
 */

export type CitationSegment = { type: "text"; value: string } | { type: "cite"; n: number };

const MARKER = /\[(\d+)\]/g;

export function splitCitationText(text: string): CitationSegment[] {
  const segments: CitationSegment[] = [];
  let last = 0;
  for (let m = MARKER.exec(text); m !== null; m = MARKER.exec(text)) {
    if (m.index > last) {
      segments.push({ type: "text", value: text.slice(last, m.index) });
    }
    segments.push({ type: "cite", n: Number(m[1]) });
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    segments.push({ type: "text", value: text.slice(last) });
  }
  // Always return at least one segment so callers can cheaply detect "no markers".
  return segments.length > 0 ? segments : [{ type: "text", value: text }];
}
