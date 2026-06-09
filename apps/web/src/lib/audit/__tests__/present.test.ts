import { describe, expect, it } from "vitest";

import {
  actorLabel,
  presentActivity,
  presentActivityFeed,
  type ActivityRow,
} from "@/lib/audit/present";

/**
 * Day 62 — pure audit-feed presentation. No DB; just the raw activity row →
 * human-readable event mapping.
 */

function row(over: Partial<ActivityRow>): ActivityRow {
  return {
    id: "a1",
    source: "schedule",
    actor: "manager",
    action: "schedule.published",
    entity_type: "schedule",
    entity_id: "s1",
    model: null,
    detail: {},
    created_at: "2026-06-08T12:00:00.000Z",
    ...over,
  };
}

describe("actorLabel", () => {
  it("maps every actor code to a friendly label, defaulting to System", () => {
    expect(actorLabel("ai")).toBe("AI agent");
    expect(actorLabel("agent")).toBe("AI agent");
    expect(actorLabel("human")).toBe("Manager");
    expect(actorLabel("manager")).toBe("Manager");
    expect(actorLabel("employee")).toBe("Employee");
    expect(actorLabel("system")).toBe("System");
    expect(actorLabel("???")).toBe("System");
  });
});

describe("presentActivity", () => {
  it("labels a known scheduling action", () => {
    const e = presentActivity(row({ action: "schedule.published", actor: "manager" }));
    expect(e.title).toBe("Schedule published");
    expect(e.category).toBe("change");
    expect(e.source).toBe("schedule");
    expect(e.actorLabel).toBe("Manager");
  });

  it("labels a known agent action and carries the model", () => {
    const e = presentActivity(
      row({ source: "agent", action: "model_call", actor: "ai", model: "deepseek-chat" }),
    );
    expect(e.title).toBe("AI model call");
    expect(e.category).toBe("system");
    expect(e.source).toBe("agent");
    expect(e.model).toBe("deepseek-chat");
  });

  it("flags escalations distinctly", () => {
    expect(presentActivity(row({ action: "replacement.escalated" })).category).toBe("escalation");
    expect(presentActivity(row({ source: "agent", action: "tool_error" })).category).toBe("escalation");
  });

  it("treats takeover/manual_reply as manager decisions", () => {
    expect(presentActivity(row({ source: "agent", action: "takeover", actor: "human" }))).toMatchObject({
      title: "Manager took over the agent",
      category: "decision",
      actorLabel: "Manager",
    });
  });

  it("humanizes an unknown action and defaults to system category", () => {
    const e = presentActivity(row({ action: "some_new.future_action" }));
    expect(e.title).toBe("Some new future action");
    expect(e.category).toBe("system");
  });

  it("normalizes an unexpected source to 'schedule'", () => {
    expect(presentActivity(row({ source: "weird" as unknown as ActivityRow["source"] })).source).toBe(
      "schedule",
    );
  });
});

describe("presentActivityFeed", () => {
  it("maps a list preserving order", () => {
    const out = presentActivityFeed([
      row({ id: "1", action: "schedule.created" }),
      row({ id: "2", source: "agent", action: "takeover" }),
    ]);
    expect(out.map((e) => e.id)).toEqual(["1", "2"]);
    expect(out.map((e) => e.title)).toEqual(["Schedule draft created", "Manager took over the agent"]);
  });
});
