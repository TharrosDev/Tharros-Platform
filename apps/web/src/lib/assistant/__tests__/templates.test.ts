import { describe, expect, it } from "vitest";

import { GROUNDING_RULES } from "@/lib/documents/rag-prompt";
import {
  isTemplateId,
  TEMPLATES,
  templateSystemPrompt,
  type TemplateId,
} from "@/lib/assistant/templates";

const IDS: TemplateId[] = ["draft_email", "write_sop", "summarize_policy"];

describe("isTemplateId", () => {
  it("accepts the three known template ids", () => {
    for (const id of IDS) expect(isTemplateId(id)).toBe(true);
  });

  it("rejects unknown strings and non-strings", () => {
    expect(isTemplateId("draft")).toBe(false);
    expect(isTemplateId("")).toBe(false);
    expect(isTemplateId(undefined)).toBe(false);
    expect(isTemplateId(null)).toBe(false);
    expect(isTemplateId(42)).toBe(false);
  });
});

describe("TEMPLATES registry", () => {
  it("lists exactly the three templates with the required UI fields", () => {
    expect(TEMPLATES.map((t) => t.id)).toEqual(IDS);
    for (const t of TEMPLATES) {
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.description.length).toBeGreaterThan(0);
      expect(t.placeholder.length).toBeGreaterThan(0);
    }
  });
});

describe("templateSystemPrompt", () => {
  it("embeds the shared grounding rules for every template", () => {
    for (const id of IDS) {
      expect(templateSystemPrompt(id)).toContain(GROUNDING_RULES);
    }
  });

  it("includes deliverable-specific instructions per template", () => {
    expect(templateSystemPrompt("draft_email").toLowerCase()).toContain("email");
    expect(templateSystemPrompt("draft_email")).toContain("Subject:");
    expect(templateSystemPrompt("write_sop")).toContain("Standard Operating Procedure");
    expect(templateSystemPrompt("summarize_policy").toLowerCase()).toContain("summar");
  });
});
