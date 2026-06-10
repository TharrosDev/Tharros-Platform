import { describe, expect, it } from "vitest";

import { fuzzyFilter, fuzzyMatch } from "../fuzzy";

describe("fuzzyMatch", () => {
  it("matches a plain substring", () => {
    expect(fuzzyMatch("sched", "Scheduling")).not.toBeNull();
  });

  it("matches a subsequence across words", () => {
    expect(fuzzyMatch("schcal", "Scheduling calendar")).not.toBeNull();
    expect(fuzzyMatch("sch cal", "Scheduling calendar")).not.toBeNull();
  });

  it("rejects when characters are out of order", () => {
    expect(fuzzyMatch("lacs", "calendar")).toBeNull();
  });

  it("rejects when a character is missing", () => {
    expect(fuzzyMatch("xyz", "Dashboard")).toBeNull();
  });

  it("is case-insensitive", () => {
    expect(fuzzyMatch("DASH", "dashboard")).not.toBeNull();
  });

  it("empty query matches everything with zero score", () => {
    expect(fuzzyMatch("", "anything")).toEqual({ score: 0, indices: [] });
  });

  it("ranks word-start matches above mid-word matches", () => {
    const wordStart = fuzzyMatch("cal", "Schedule calendar")!;
    const midWord = fuzzyMatch("cal", "Physical")!;
    expect(wordStart.score).toBeGreaterThan(midWord.score);
  });

  it("returns matched indices for highlighting", () => {
    const result = fuzzyMatch("dash", "Dashboard")!;
    expect(result.indices).toEqual([0, 1, 2, 3]);
  });
});

describe("fuzzyFilter", () => {
  const pages = [
    "Dashboard",
    "AI Assistant",
    "Scheduling",
    "Knowledge",
    "Billing",
    "Settings",
    "Invite a teammate",
  ];

  it("filters out non-matches", () => {
    const result = fuzzyFilter("sett", pages, (p) => p);
    expect(result).toEqual(["Settings"]);
  });

  it("ranks the best match first", () => {
    const result = fuzzyFilter("in", pages, (p) => p);
    expect(result[0]).toBe("Invite a teammate");
  });

  it("returns the head of the list for an empty query", () => {
    expect(fuzzyFilter("", pages, (p) => p, 3)).toEqual(pages.slice(0, 3));
  });

  it("caps results at the limit", () => {
    const result = fuzzyFilter("i", pages, (p) => p, 2);
    expect(result).toHaveLength(2);
  });
});
