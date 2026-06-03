import { describe, expect, it } from "vitest";

import { draftFilename } from "@/lib/assistant/export";

describe("draftFilename", () => {
  it("slugs a label and appends the extension", () => {
    expect(draftFilename("Draft email", "md")).toBe("draft-email.md");
    expect(draftFilename("Summarize policy", "md")).toBe("summarize-policy.md");
  });

  it("collapses runs of non-alphanumerics and trims edges", () => {
    expect(draftFilename("  SOP: returns & refunds!! ", "txt")).toBe("sop-returns-refunds.txt");
  });

  it("strips a leading dot from the extension", () => {
    expect(draftFilename("answer", ".md")).toBe("answer.md");
  });

  it("falls back to 'draft' when the label has no usable characters", () => {
    expect(draftFilename("!!!", "md")).toBe("draft.md");
  });
});
