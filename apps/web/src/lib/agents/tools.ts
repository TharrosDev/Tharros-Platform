/**
 * Day 39 — the tool-calling seam. A tool registry that maps a tool name to its
 * Anthropic tool definition + a handler. Pure (no `server-only`, no secrets) so
 * it's unit-testable directly. Mirrors the lib/jobs `HANDLERS` registry, made
 * first-class for agent tools.
 *
 * Day 39 ships only the trivial built-in `echo` tool — enough to prove the
 * tool-use loop end to end. The real scheduling tools (run the solver, read
 * availability, write shifts) register here on Days 46–48 as `AgentTool`s with
 * no change to the turn handler.
 *
 * Handlers receive a `ToolContext` carrying the org + both Supabase clients, so a
 * tool never reaches for a client itself and every DB touch stays tenancy-scoped.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";

/**
 * Execution context handed to every tool handler. The RLS user-session client is
 * the default for reads; `admin` (service-role) is for privileged writes a tool
 * legitimately needs — use it sparingly and always scope writes to `orgId`.
 */
export type ToolContext = {
  orgId: string;
  userId: string | null;
  supabase: SupabaseClient;
  admin: SupabaseClient;
};

/** What a tool returns to Claude. `content` becomes the tool_result text. */
export type ToolResult = {
  content: string;
  isError?: boolean;
};

export type ToolHandler<I = unknown> = (ctx: ToolContext, input: I) => Promise<ToolResult>;

export type AgentTool<I = unknown> = {
  /** The Anthropic tool definition: name + description + JSON input_schema. */
  definition: Tool;
  /**
   * Validate the raw Claude-supplied input, then run the side effect. Declared
   * with method syntax (not a `ToolHandler<I>` property) so parameter checking is
   * bivariant — a typed `AgentTool<{ x }>` is assignable to the registry's
   * `AgentTool<unknown>` slot.
   */
  handler(ctx: ToolContext, input: I): Promise<ToolResult>;
};

export type ToolRegistry = {
  /** The tool registered under `name`, or null (→ the loop returns a tool error). */
  get(name: string): AgentTool | null;
  /** The Anthropic `tools` array to attach to a request. */
  toolDefs(): Tool[];
  /** Register (or replace) a tool. */
  register(tool: AgentTool): void;
};

/**
 * The built-in trivial tool. Echoes its `text` back — proves the tool_use →
 * tool_result loop without any side effect. Template for real tools.
 */
export const ECHO_TOOL: AgentTool<{ text: string }> = {
  definition: {
    name: "echo",
    description:
      "Echo the provided text back verbatim. A trivial no-op tool used to exercise the agent tool loop.",
    input_schema: {
      type: "object",
      properties: { text: { type: "string", description: "Text to echo back." } },
      required: ["text"],
    },
  },
  handler: async (_ctx, input) => ({ content: String(input?.text ?? "") }),
};

/** Create a registry seeded with `tools` (defaults to just the echo tool). */
export function createToolRegistry(tools: AgentTool[] = [ECHO_TOOL]): ToolRegistry {
  const map = new Map<string, AgentTool>();
  for (const t of tools) map.set(t.definition.name, t);

  return {
    get(name) {
      return map.get(name) ?? null;
    },
    toolDefs() {
      return [...map.values()].map((t) => t.definition);
    },
    register(tool) {
      map.set(tool.definition.name, tool);
    },
  };
}
