import { describe, expect, it } from "vitest";

import { publishGate } from "../publish";
import type { EditViolation } from "../validation";

/**
 * Day 51 — pure publish-gate logic. Hard violations always block; open shifts and
 * soft warnings need an explicit manager override; a clean board publishes freely.
 */

function v(severity: "hard" | "soft"): EditViolation {
  return { rule: severity === "hard" ? "double_booking" : "overtime_threshold", severity, message: "x" };
}

describe("publishGate", () => {
  it("allows a clean, fully-covered schedule", () => {
    expect(publishGate([], 0, false)).toEqual({ allowed: true });
  });

  it("blocks while a hard violation stands, even with override", () => {
    const withOverride = publishGate([v("hard")], 0, true);
    expect(withOverride.allowed).toBe(false);
    expect(withOverride.blockReason).toContain("conflict");
    expect(publishGate([v("hard"), v("hard")], 0, false).blockReason).toContain("2 conflicts");
  });

  it("blocks open shifts until acknowledged, then allows with override", () => {
    const blocked = publishGate([], 3, false);
    expect(blocked.allowed).toBe(false);
    expect(blocked.blockReason).toContain("3 open shifts");
    expect(publishGate([], 3, true)).toEqual({ allowed: true });
  });

  it("blocks soft warnings until acknowledged, then allows with override", () => {
    const blocked = publishGate([v("soft")], 0, false);
    expect(blocked.allowed).toBe(false);
    expect(blocked.blockReason).toContain("1 warning");
    expect(publishGate([v("soft")], 0, true)).toEqual({ allowed: true });
  });

  it("hard violations take precedence over coverage even with override", () => {
    expect(publishGate([v("hard"), v("soft")], 2, true).allowed).toBe(false);
  });

  it("lists both open shifts and warnings in the block reason", () => {
    const r = publishGate([v("soft")], 2, false);
    expect(r.blockReason).toContain("2 open shifts");
    expect(r.blockReason).toContain("1 warning");
  });
});
