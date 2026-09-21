import type { Citation } from "@/lib/documents/rag-prompt";
import type { DataBlock, ProposalView } from "@/lib/assistant/types";

/**
 * Day 29 — the wire protocol between the streaming chat endpoint
 * (`/api/assistant/query`) and the client. Newline-delimited JSON (NDJSON): one
 * JSON object per line. Kept pure (no `server-only`, no I/O) so both the route
 * and the browser import it, and so it is unit-testable in CI.
 *
 * Frame order on a normal turn:
 *   meta   → once, first: the conversation id + citations (known from retrieval
 *            before generation) + whether the answer is grounded.
 *   delta  → zero or more: a chunk of answer text, in order.
 *   status → zero or more: a short line about a tool call ("Checking the schedule").
 *   proposal → zero or more: a change the assistant proposes for the user to confirm.
 *   sources  → at most once, before done: citations gathered by tool searches.
 *   done   → once, last: the turn finished and was persisted.
 * On failure, a single `error` frame replaces `done`.
 */

export type ChatStreamEvent =
  | { type: "meta"; conversationId: string; citations: Citation[]; grounded: boolean }
  | { type: "delta"; text: string }
  | { type: "status"; label: string }
  | { type: "proposal"; proposal: ProposalView }
  | { type: "sources"; citations: Citation[] }
  | { type: "data"; block: DataBlock }
  | { type: "suggestions"; items: string[] }
  | { type: "done"; messageId?: string }
  | { type: "error"; message: string };

/** Encode one event as a single NDJSON line (trailing newline included). */
export function encodeFrame(event: ChatStreamEvent): string {
  return JSON.stringify(event) + "\n";
}

/**
 * Stateful decoder for an NDJSON byte/text stream. Call `push` with each chunk
 * as it arrives (chunks may split a line anywhere); it returns the events that
 * completed in this chunk and buffers any partial trailing line for the next
 * call. Blank lines are skipped; malformed lines are ignored rather than thrown,
 * so a torn final chunk never crashes the reader.
 */
export function createFrameDecoder() {
  let buffer = "";

  return {
    push(chunk: string): ChatStreamEvent[] {
      buffer += chunk;
      const lines = buffer.split("\n");
      // The last element is the (possibly empty) partial line — keep it buffered.
      buffer = lines.pop() ?? "";

      const events: ChatStreamEvent[] = [];
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          events.push(JSON.parse(trimmed) as ChatStreamEvent);
        } catch {
          // Ignore a malformed line rather than tearing down the stream.
        }
      }
      return events;
    },
  };
}

/**
 * Parse a complete NDJSON string into events in one shot (used by tests and any
 * non-streaming caller). For incremental decoding use `createFrameDecoder`.
 */
export function parseFrames(ndjson: string): ChatStreamEvent[] {
  const decoder = createFrameDecoder();
  return decoder.push(ndjson.endsWith("\n") ? ndjson : ndjson + "\n");
}
