import { describe, expect, it, vi } from "vitest";
import type { Message } from "@anthropic-ai/sdk/resources/messages";

import { runTurnLoop, type TurnLoopIO } from "@/lib/agents/turn-loop";
import { createToolRegistry } from "@/lib/agents/tools";
import type { AgentThread } from "@/lib/agents/types";

/**
 * Day 39 — the agentic turn loop. Pure, provider-free: a fake IO records the
 * side effects and canned Claude responses drive the branches.
 */

function thread(over: Partial<AgentThread> = {}): AgentThread {
  return {
    id: "t1",
    orgId: "org",
    createdBy: null,
    kind: "agent",
    title: "T",
    mode: "ai",
    status: "open",
    takenOverBy: null,
    takenOverAt: null,
    createdAt: "2026-06-09T00:00:00Z",
    updatedAt: "2026-06-09T00:00:00Z",
    ...over,
  };
}

function endTurn(text: string): Message {
  return {
    id: "m",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-4-6",
    stop_reason: "end_turn",
    stop_sequence: null,
    content: [{ type: "text", text } as never],
    usage: { input_tokens: 1, output_tokens: 1 } as never,
  } as unknown as Message;
}

function toolUse(name: string, input: unknown): Message {
  return {
    id: "m",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-4-6",
    stop_reason: "tool_use",
    stop_sequence: null,
    content: [{ type: "tool_use", id: "tu", name, input } as never],
    usage: { input_tokens: 1, output_tokens: 1 } as never,
  } as unknown as Message;
}

function makeIO(over: Partial<TurnLoopIO> & { thread?: AgentThread | null }): {
  io: TurnLoopIO;
  spies: Record<string, ReturnType<typeof vi.fn>>;
} {
  const spies = {
    appendTurn: vi.fn(async () => "turn-id"),
    callModel: vi.fn(),
    executeTool: vi.fn(),
    recordUsage: vi.fn(async () => {}),
    audit: vi.fn(async () => {}),
    touchThread: vi.fn(async () => {}),
  };
  const io: TurnLoopIO = {
    getThread: async () => ("thread" in over ? over.thread! : thread()),
    listTurns: async () => [],
    appendTurn: spies.appendTurn,
    callModel: over.callModel ?? spies.callModel,
    executeTool: over.executeTool ?? spies.executeTool,
    recordUsage: spies.recordUsage,
    audit: spies.audit,
    touchThread: spies.touchThread,
  };
  return { io, spies };
}

const actions = (spy: ReturnType<typeof vi.fn>) => spy.mock.calls.map((c) => c[0].action);

describe("runTurnLoop", () => {
  it("runs a single end_turn to completion and meters usage once", async () => {
    const { io, spies } = makeIO({ callModel: vi.fn(async () => endTurn("done")) });

    const result = await runTurnLoop({ registry: createToolRegistry(), io });

    expect(result).toMatchObject({ ran: true, steps: 1, finalText: "done", hitStepCap: false });
    expect(spies.recordUsage).toHaveBeenCalledTimes(1);
    expect(spies.touchThread).toHaveBeenCalledTimes(1);
    expect(actions(spies.audit)).toContain("turn_started");
    expect(actions(spies.audit)).toContain("turn_completed");
  });

  it("executes a tool_use, feeds the result back, and finishes", async () => {
    const callModel = vi
      .fn()
      .mockResolvedValueOnce(toolUse("echo", { text: "hi" }))
      .mockResolvedValueOnce(endTurn("ok"));
    const executeTool = vi.fn(async () => ({ content: "hi" }));
    const { io, spies } = makeIO({ callModel, executeTool });

    const result = await runTurnLoop({ registry: createToolRegistry(), io });

    expect(result).toMatchObject({ ran: true, steps: 2, finalText: "ok" });
    expect(executeTool).toHaveBeenCalledTimes(1);
    // assistant turn + tool turn for step 1, assistant turn for step 2.
    const roles = spies.appendTurn.mock.calls.map((c) => c[0].role);
    expect(roles).toEqual(["assistant", "tool", "assistant"]);
    expect(actions(spies.audit)).toContain("tool_invoked");
  });

  it("returns a tool error block for an unknown tool (no crash)", async () => {
    const callModel = vi
      .fn()
      .mockResolvedValueOnce(toolUse("ghost", {}))
      .mockResolvedValueOnce(endTurn("recovered"));
    const { io, spies } = makeIO({ callModel });

    const result = await runTurnLoop({ registry: createToolRegistry([]), io });

    expect(result).toMatchObject({ ran: true });
    expect(actions(spies.audit)).toContain("tool_error");
    const toolTurn = spies.appendTurn.mock.calls.find((c) => c[0].role === "tool")![0];
    expect(toolTurn.content[0]).toMatchObject({ type: "tool_result", is_error: true });
  });

  it("bypasses the AI entirely when a manager has taken over (mode=human)", async () => {
    const callModel = vi.fn();
    const { io, spies } = makeIO({ thread: thread({ mode: "human" }), callModel });

    const result = await runTurnLoop({ registry: createToolRegistry(), io });

    expect(result).toEqual({ ran: false, reason: "human_owned" });
    expect(callModel).not.toHaveBeenCalled();
    expect(actions(spies.audit)).toEqual(["turn_skipped_human"]);
  });

  it("skips a closed thread", async () => {
    const callModel = vi.fn();
    const { io } = makeIO({ thread: thread({ status: "closed" }), callModel });
    const result = await runTurnLoop({ registry: createToolRegistry(), io });
    expect(result).toEqual({ ran: false, reason: "closed" });
    expect(callModel).not.toHaveBeenCalled();
  });

  it("returns not_found when the thread is missing", async () => {
    const { io } = makeIO({ thread: null });
    expect(await runTurnLoop({ registry: createToolRegistry(), io })).toEqual({
      ran: false,
      reason: "not_found",
    });
  });

  it("halts at the step cap on a runaway tool loop", async () => {
    const callModel = vi.fn(async () => toolUse("echo", { text: "again" }));
    const executeTool = vi.fn(async () => ({ content: "again" }));
    const { io } = makeIO({ callModel, executeTool });

    const result = await runTurnLoop({ registry: createToolRegistry(), io, maxSteps: 3 });

    expect(result).toMatchObject({ ran: true, steps: 3, hitStepCap: true });
    expect(callModel).toHaveBeenCalledTimes(3);
  });
});
