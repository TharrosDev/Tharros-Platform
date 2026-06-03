import { describe, expect, it } from "vitest";

import {
  createFrameDecoder,
  encodeFrame,
  parseFrames,
  type ChatStreamEvent,
} from "@/lib/assistant/stream-protocol";

const META: ChatStreamEvent = {
  type: "meta",
  conversationId: "conv-1",
  citations: [{ index: 1, documentId: "d1", filename: "handbook.pdf", chunkIndices: [0, 2] }],
  grounded: true,
};

describe("encodeFrame", () => {
  it("serializes one event as a single newline-terminated JSON line", () => {
    const line = encodeFrame({ type: "delta", text: "hello" });
    expect(line).toBe('{"type":"delta","text":"hello"}\n');
  });
});

describe("parseFrames", () => {
  it("round-trips a full turn through encode → parse", () => {
    const events: ChatStreamEvent[] = [
      META,
      { type: "delta", text: "30 days" },
      { type: "delta", text: " from purchase." },
      { type: "done" },
    ];
    const wire = events.map(encodeFrame).join("");
    expect(parseFrames(wire)).toEqual(events);
  });

  it("tolerates a trailing line with no newline", () => {
    const wire = '{"type":"done"}';
    expect(parseFrames(wire)).toEqual([{ type: "done" }]);
  });

  it("skips blank lines and ignores malformed lines", () => {
    const wire = '\n{"type":"delta","text":"ok"}\nnot-json\n\n';
    expect(parseFrames(wire)).toEqual([{ type: "delta", text: "ok" }]);
  });
});

describe("createFrameDecoder", () => {
  it("reassembles events split across arbitrary chunk boundaries", () => {
    const events: ChatStreamEvent[] = [META, { type: "delta", text: "a" }, { type: "done" }];
    const wire = events.map(encodeFrame).join("");

    const decoder = createFrameDecoder();
    const out: ChatStreamEvent[] = [];
    // Feed the stream one character at a time — the worst-case fragmentation.
    for (const ch of wire) out.push(...decoder.push(ch));

    expect(out).toEqual(events);
  });

  it("buffers a partial line until its newline arrives", () => {
    const decoder = createFrameDecoder();
    expect(decoder.push('{"type":"del')).toEqual([]);
    expect(decoder.push('ta","text":"hi"}\n')).toEqual([{ type: "delta", text: "hi" }]);
  });
});
