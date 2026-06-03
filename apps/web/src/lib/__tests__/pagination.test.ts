import { describe, it, expect } from "vitest";

import { encodeCursor, decodeCursor, nextCursorFrom } from "@/lib/pagination";

describe("pagination cursor codec", () => {
  it("round-trips a cursor", () => {
    const c = { ts: "2026-06-03T14:58:46.123456+00:00", id: "11111111-2222-3333-4444-555555555555" };
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
  });

  it("treats null/empty/garbage as no cursor", () => {
    expect(decodeCursor(null)).toBeNull();
    expect(decodeCursor("")).toBeNull();
    expect(decodeCursor("not-base64-$$$")).toBeNull();
    // base64 of a string with no separator → null
    expect(decodeCursor(Buffer.from("noseparator", "utf8").toString("base64url"))).toBeNull();
  });

  it("preserves ids that themselves contain the separator space", () => {
    // The decoder splits on the FIRST space, so a ts never bleeds into the id.
    const c = { ts: "2026-01-01T00:00:00+00:00", id: "abc def" };
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
  });
});

describe("nextCursorFrom", () => {
  const pick = (r: { updatedAt: string; id: string }) => ({ ts: r.updatedAt, id: r.id });

  it("returns null when the page was not full (no more rows)", () => {
    const rows = [{ updatedAt: "t1", id: "a" }];
    expect(nextCursorFrom(rows, 50, pick)).toBeNull();
  });

  it("returns a cursor at the last row when the page was full", () => {
    const rows = [
      { updatedAt: "t1", id: "a" },
      { updatedAt: "t2", id: "b" },
    ];
    const token = nextCursorFrom(rows, 2, pick);
    expect(token).not.toBeNull();
    expect(decodeCursor(token)).toEqual({ ts: "t2", id: "b" });
  });

  it("returns null for an empty page", () => {
    expect(nextCursorFrom([], 50, pick)).toBeNull();
  });
});
