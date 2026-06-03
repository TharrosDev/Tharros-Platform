import { describe, expect, it } from "vitest";

import { CHEAP_MODEL, DEFAULT_MODEL, modelForTemplate } from "../models";

/**
 * Day 33 — model routing. Pure module (no `server-only`), so the routing rule
 * is unit-testable without the SDK client seam.
 */

describe("modelForTemplate", () => {
  it("routes a generation template to the cheap model", () => {
    expect(modelForTemplate("draft_email")).toBe(CHEAP_MODEL);
    expect(modelForTemplate("write_sop")).toBe(CHEAP_MODEL);
    expect(modelForTemplate("summarize_policy")).toBe(CHEAP_MODEL);
  });

  it("keeps plain Q&A (no template) on the default model", () => {
    expect(modelForTemplate(null)).toBe(DEFAULT_MODEL);
    expect(modelForTemplate(undefined)).toBe(DEFAULT_MODEL);
  });

  it("routes the cheap and default models to distinct ids", () => {
    expect(CHEAP_MODEL).not.toBe(DEFAULT_MODEL);
  });
});
