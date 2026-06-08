import { describe, expect, it } from "vitest";

import {
  HUMAN_TAKEOVER_STOP_REASON,
  classifyTurn,
  extractText,
  presentTurn,
  renderTurnText,
  threadKindLabel,
  threadStatusBadge,
} from "@/lib/agents/present";
import type { AgentThread, AgentTurn } from "@/lib/agents/types";

/**
 * Day 58 — pure presentation logic for the conversation-takeover UI. No DB; just
 * the turn → display mapping, voice classification, and thread chrome.
 */

function turn(over: Partial<AgentTurn>): AgentTurn {
  return {
    id: "t1",
    threadId: "th1",
    orgId: "o1",
    role: "assistant",
    content: [],
    stopReason: null,
    usage: null,
    createdAt: "2026-06-08T12:00:00.000Z",
    ...over,
  };
}

describe("extractText / renderTurnText", () => {
  it("joins multiple text blocks", () => {
    const t = turn({ content: [{ type: "text", text: "Hi" }, { type: "text", text: "there" }] });
    expect(extractText(t.content)).toBe("Hi\n\nthere");
  });

  it("summarizes a tool_use block when there is no text", () => {
    const t = turn({
      role: "assistant",
      content: [{ type: "tool_use", id: "x", name: "solve_schedule", input: { weekOf: "2026-06-08" } }],
    });
    expect(renderTurnText(t)).toBe("Ran tool solve_schedule (weekOf)");
  });

  it("renders a tool_result, flagging errors", () => {
    const ok = turn({
      role: "tool",
      content: [{ type: "tool_result", tool_use_id: "x", content: "covered" }],
    });
    expect(renderTurnText(ok)).toBe("Tool result: covered");

    const err = turn({
      role: "tool",
      content: [{ type: "tool_result", tool_use_id: "x", content: "boom", is_error: true }],
    });
    expect(renderTurnText(err)).toBe("Tool error: boom");
  });

  it("never returns blank — falls back via presentTurn", () => {
    const t = turn({ role: "assistant", content: [] });
    expect(presentTurn(t).text).toBe("(no message)");
  });
});

describe("classifyTurn", () => {
  it("classifies an employee (user text) turn", () => {
    const t = turn({ role: "user", content: [{ type: "text", text: "can't make it" }] });
    expect(classifyTurn(t)).toBe("employee");
  });

  it("classifies a plain assistant turn as the agent", () => {
    const t = turn({ role: "assistant", content: [{ type: "text", text: "Got it" }] });
    expect(classifyTurn(t)).toBe("agent");
  });

  it("classifies a takeover-stamped assistant turn as the manager", () => {
    const t = turn({
      role: "assistant",
      stopReason: HUMAN_TAKEOVER_STOP_REASON,
      content: [{ type: "text", text: "I'll handle this" }],
    });
    expect(classifyTurn(t)).toBe("manager");
  });

  it("classifies a tool-role turn and a tool-only assistant turn as tool", () => {
    expect(
      classifyTurn(turn({ role: "tool", content: [{ type: "tool_result", tool_use_id: "x", content: "y" }] })),
    ).toBe("tool");
    expect(
      classifyTurn(turn({ role: "assistant", content: [{ type: "tool_use", id: "x", name: "n", input: {} }] })),
    ).toBe("tool");
  });
});

describe("presentTurn labels", () => {
  it("relabels a manager turn the viewer authored as 'You (manager)'", () => {
    const t = turn({ role: "assistant", stopReason: HUMAN_TAKEOVER_STOP_REASON, content: [{ type: "text", text: "x" }] });
    expect(presentTurn(t, true).label).toBe("You (manager)");
    expect(presentTurn(t, false).label).toBe("Manager");
  });
});

describe("thread chrome", () => {
  it("labels known kinds and humanizes unknown ones", () => {
    expect(threadKindLabel("sick_call")).toBe("Sick call");
    expect(threadKindLabel("schedule_opt")).toBe("Schedule generation");
    expect(threadKindLabel("mystery_kind")).toBe("mystery kind");
  });

  it("derives the status badge from mode + status", () => {
    const base = { mode: "ai", status: "open" } as Pick<AgentThread, "mode" | "status">;
    expect(threadStatusBadge(base)).toEqual({ label: "AI handling", tone: "outline" });
    expect(threadStatusBadge({ mode: "human", status: "open" })).toEqual({
      label: "You took over",
      tone: "destructive",
    });
    expect(threadStatusBadge({ mode: "human", status: "closed" })).toEqual({
      label: "Resolved",
      tone: "secondary",
    });
  });
});
