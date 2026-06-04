import { describe, expect, it } from "vitest";

import { createToolRegistry, ECHO_TOOL, type AgentTool } from "@/lib/agents/tools";

/**
 * Day 39 — tool registry (the tool-calling seam). Pure, provider-free.
 */

const ctx = { orgId: "org", userId: null, supabase: {} as never, admin: {} as never };

describe("createToolRegistry", () => {
  it("seeds the echo tool by default", () => {
    const registry = createToolRegistry();
    expect(registry.get("echo")).toBe(ECHO_TOOL);
    expect(registry.toolDefs().map((t) => t.name)).toEqual(["echo"]);
  });

  it("returns null for an unknown tool", () => {
    expect(createToolRegistry().get("nope")).toBeNull();
  });

  it("registers (and replaces) tools", () => {
    const registry = createToolRegistry([]);
    expect(registry.toolDefs()).toHaveLength(0);

    const tool: AgentTool<{ x: number }> = {
      definition: {
        name: "double",
        description: "double x",
        input_schema: { type: "object", properties: { x: { type: "number" } }, required: ["x"] },
      },
      handler: async (_c, input) => ({ content: String(input.x * 2) }),
    };
    registry.register(tool);
    expect(registry.get("double")).toBe(tool);
    expect(registry.toolDefs().map((t) => t.name)).toEqual(["double"]);
  });
});

describe("echo tool", () => {
  it("echoes its text back", async () => {
    const result = await ECHO_TOOL.handler(ctx, { text: "hello" });
    expect(result).toEqual({ content: "hello" });
  });

  it("tolerates a missing text field", async () => {
    const result = await ECHO_TOOL.handler(ctx, {} as { text: string });
    expect(result.content).toBe("");
  });
});
