/**
 * Day 39 — the agentic turn loop, kept pure (no `server-only`) so it's
 * unit-testable with fakes. All side effects (DB reads/writes, the Claude call,
 * tool execution, usage metering, audit) are injected via `TurnLoopIO`; the
 * server-only `turn-handler` wires the real implementations.
 *
 * One call = one agent turn: build the message history + available tools, call
 * Claude, and run the tool-use loop (tool_use → execute → tool_result → continue
 * until end_turn / refusal / a hard step cap). The MANAGER-TAKEOVER seam lives at
 * the top: a thread in mode 'human' is bypassed entirely — no Claude call, no
 * cost. The step cap is the runaway-loop backstop.
 */

import type {
  ContentBlock,
  ContentBlockParam,
  Message,
  MessageCreateParamsNonStreaming,
  MessageParam,
  TextBlockParam,
  Tool,
  Usage,
} from "@anthropic-ai/sdk/resources/messages";

import { DEFAULT_MODEL } from "@/lib/anthropic/models";
import type { AgentTool, ToolRegistry, ToolResult } from "@/lib/agents/tools";
import type {
  AgentAuditAction,
  AgentAuditActor,
  AgentThread,
  AgentTurn,
  AgentTurnRole,
} from "@/lib/agents/types";

/** Hard cap on Claude round-trips in one turn — backstop against a runaway tool loop. */
export const DEFAULT_MAX_STEPS = 8;

export const AGENT_SYSTEM_PROMPT = `You are an operations agent for a small business, working inside the Tharros platform.

You coordinate work by calling the tools made available to you. Reason about what the manager or employee needs, call tools to read or change state, and only stop when the task is done or you need a human. Be concise and direct. Never invent data you have not read through a tool. If a request is outside your tools or judgment, say so plainly so a human can take over.`;

export type TurnLoopIO = {
  getThread(): Promise<AgentThread | null>;
  /** Prior turns, oldest-first. */
  listTurns(): Promise<AgentTurn[]>;
  appendTurn(input: {
    role: AgentTurnRole;
    content: ContentBlockParam[];
    stopReason?: string | null;
    usage?: Usage | null;
  }): Promise<string | null>;
  callModel(req: MessageCreateParamsNonStreaming): Promise<Message>;
  /** Execute a resolved tool with the wired ToolContext. */
  executeTool(tool: AgentTool, input: unknown): Promise<ToolResult>;
  recordUsage(model: string, usage: Usage | null): Promise<void>;
  audit(event: {
    actor: AgentAuditActor;
    action: AgentAuditAction;
    turnId?: string | null;
    model?: string | null;
    detail?: Record<string, unknown>;
  }): Promise<void>;
  touchThread(): Promise<void>;
};

export type RunTurnLoopArgs = {
  registry: ToolRegistry;
  io: TurnLoopIO;
  /** A new inbound message (usually from a human/employee) to append before running. */
  userMessage?: string;
  maxSteps?: number;
  model?: string;
};

export type TurnLoopResult =
  | { ran: false; reason: "not_found" | "closed" | "human_owned" }
  | { ran: true; steps: number; finalText: string; hitStepCap: boolean };

/** A tool_result content block fed back to Claude. */
function toolResultBlock(toolUseId: string, content: string, isError?: boolean): ContentBlockParam {
  return { type: "tool_result", tool_use_id: toolUseId, content, ...(isError ? { is_error: true } : {}) };
}

/** Map stored turns → Anthropic message params. Tool turns ride a user message. */
function toMessages(turns: AgentTurn[]): MessageParam[] {
  return turns.map((t) => ({
    role: t.role === "assistant" ? "assistant" : "user",
    content: t.content,
  }));
}

/** Join the text blocks of an assistant response into plain text. */
function extractText(content: ContentBlock[]): string {
  return content
    .filter((b): b is Extract<ContentBlock, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

function buildAgentRequest(
  messages: MessageParam[],
  tools: Tool[],
  model: string,
): MessageCreateParamsNonStreaming {
  const system: TextBlockParam[] = [
    { type: "text", text: AGENT_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
  ];
  return {
    model,
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    output_config: { effort: "high" },
    system,
    tools,
    messages,
  };
}

export async function runTurnLoop(args: RunTurnLoopArgs): Promise<TurnLoopResult> {
  const { registry, io } = args;
  const maxSteps = args.maxSteps ?? DEFAULT_MAX_STEPS;
  const model = args.model ?? DEFAULT_MODEL;

  const thread = await io.getThread();
  if (!thread) return { ran: false, reason: "not_found" };

  if (thread.status === "closed") {
    await io.audit({ actor: "system", action: "turn_skipped_closed" });
    return { ran: false, reason: "closed" };
  }

  // Manager-takeover seam: a human owns this thread → the AI is bypassed entirely.
  if (thread.mode === "human") {
    await io.audit({ actor: "system", action: "turn_skipped_human" });
    return { ran: false, reason: "human_owned" };
  }

  await io.audit({ actor: "ai", action: "turn_started" });

  const messages = toMessages(await io.listTurns());

  if (args.userMessage) {
    const block: ContentBlockParam = { type: "text", text: args.userMessage };
    await io.appendTurn({ role: "user", content: [block] });
    messages.push({ role: "user", content: [block] });
  }

  let steps = 0;
  let finalText = "";
  let hitStepCap = true; // flipped to false on a clean break

  while (steps < maxSteps) {
    const resp = await io.callModel(buildAgentRequest(messages, registry.toolDefs(), model));
    steps += 1;
    await io.recordUsage(resp.model, resp.usage);
    await io.audit({
      actor: "ai",
      action: "model_call",
      model: resp.model,
      detail: { stop_reason: resp.stop_reason, step: steps },
    });

    const assistantContent = resp.content as unknown as ContentBlockParam[];
    const turnId = await io.appendTurn({
      role: "assistant",
      content: assistantContent,
      stopReason: resp.stop_reason,
      usage: resp.usage,
    });
    messages.push({ role: "assistant", content: assistantContent });

    if (resp.stop_reason === "refusal") {
      await io.audit({ actor: "ai", action: "turn_refused", turnId });
      hitStepCap = false;
      break;
    }
    if (resp.stop_reason !== "tool_use") {
      finalText = extractText(resp.content);
      hitStepCap = false;
      break;
    }

    // Execute every tool_use block, then feed the results back as one user turn.
    const toolUses = resp.content.filter(
      (b): b is Extract<ContentBlock, { type: "tool_use" }> => b.type === "tool_use",
    );
    const results: ContentBlockParam[] = [];
    for (const tu of toolUses) {
      await io.audit({
        actor: "ai",
        action: "tool_invoked",
        turnId,
        detail: { name: tu.name, tool_use_id: tu.id },
      });
      const tool = registry.get(tu.name);
      if (!tool) {
        results.push(toolResultBlock(tu.id, `No tool named "${tu.name}" is available.`, true));
        await io.audit({
          actor: "ai",
          action: "tool_error",
          turnId,
          detail: { name: tu.name, error: "unknown_tool" },
        });
        continue;
      }
      try {
        const r = await io.executeTool(tool, tu.input);
        results.push(toolResultBlock(tu.id, r.content, r.isError));
      } catch (err) {
        const message = err instanceof Error ? err.message : "tool failed";
        results.push(toolResultBlock(tu.id, message, true));
        await io.audit({
          actor: "ai",
          action: "tool_error",
          turnId,
          detail: { name: tu.name, error: message },
        });
      }
    }

    await io.appendTurn({ role: "tool", content: results });
    messages.push({ role: "user", content: results });
  }

  await io.touchThread();
  await io.audit({ actor: "ai", action: "turn_completed", detail: { steps, hitStepCap } });
  return { ran: true, steps, finalText, hitStepCap };
}
