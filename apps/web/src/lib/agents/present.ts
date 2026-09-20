/**
 * Day 58 — agent conversation presentation. Pure (no `server-only`) so the
 * transcript renderer and the Vitest harness can both import it. Turns its raw
 * Anthropic content-block array (text + tool_use + tool_result) into something a
 * manager can read, and classifies who is "speaking" so the takeover UI can give
 * each turn the right voice — employee, the AI agent, the manager (after a
 * takeover), a tool call, or a tool result.
 */

import type { ContentBlockParam } from "@anthropic-ai/sdk/resources/messages";

import type { AgentThread, AgentTurn, AgentTurnRole } from "@/lib/agents/types";

/**
 * Sentinel `stop_reason` stamped on an `assistant` turn that a human manager
 * authored after taking the thread over (see `postManualReplyAction`). Lets the
 * presenter tell a manager's reply apart from the AI's, with no schema change.
 */
export const HUMAN_TAKEOVER_STOP_REASON = "human_takeover";

/** Who a turn reads as in the transcript. Drives bubble alignment + label. */
export type TurnVoice = "employee" | "agent" | "manager" | "tool" | "system";

export type PresentedTurn = {
  id: string;
  voice: TurnVoice;
  /** Human-facing label, e.g. "Employee", "Tharros agent", "You (manager)". */
  label: string;
  /** Rendered, display-ready text. Never empty — tool calls get a summary. */
  text: string;
  createdAt: string;
};

const VOICE_LABEL: Record<TurnVoice, string> = {
  employee: "Employee",
  agent: "Tharros agent",
  manager: "Manager",
  tool: "Tool call",
  system: "System",
};

/** Concatenate every `text` block of a content array (ignores other blocks). */
export function extractText(content: ContentBlockParam[]): string {
  return content
    .filter((b): b is Extract<ContentBlockParam, { type: "text" }> => b.type === "text")
    .map((b) => (typeof b.text === "string" ? b.text : ""))
    .join("\n\n")
    .trim();
}

/** A short, human summary of a tool_use block: `solve_schedule({ weekOf: … })`. */
function summarizeToolUse(name: string, input: unknown): string {
  const keys =
    input && typeof input === "object" && !Array.isArray(input)
      ? Object.keys(input as Record<string, unknown>)
      : [];
  const arg = keys.length ? ` (${keys.join(", ")})` : "";
  return `Ran tool ${name}${arg}`;
}

/** Stringify a tool_result block's content (string or content-block array). */
function stringifyToolResult(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((b) =>
        b &&
        typeof b === "object" &&
        "text" in b &&
        typeof (b as { text: unknown }).text === "string"
          ? (b as { text: string }).text
          : "",
      )
      .join("\n")
      .trim();
  }
  return "";
}

/**
 * Render a turn's content blocks to display text. Prefers human-readable text;
 * falls back to a compact summary of tool_use / tool_result blocks so a turn is
 * never blank in the transcript.
 */
export function renderTurnText(turn: Pick<AgentTurn, "content">): string {
  const text = extractText(turn.content);
  if (text) return text;

  const parts: string[] = [];
  for (const block of turn.content) {
    if (block.type === "tool_use") {
      parts.push(summarizeToolUse(block.name, block.input));
    } else if (block.type === "tool_result") {
      const out = stringifyToolResult(block.content);
      const flagged = block.is_error ? "Tool error" : "Tool result";
      parts.push(out ? `${flagged}: ${out}` : flagged);
    }
  }
  return parts.join("\n\n").trim();
}

/** Does any block in the turn carry a tool call or tool result? */
function hasToolBlock(content: ContentBlockParam[]): boolean {
  return content.some((b) => b.type === "tool_use" || b.type === "tool_result");
}

/**
 * Classify a turn's voice. The role + a couple of signals are enough:
 *   - `tool` role, or an assistant turn that is purely tool calls → tool
 *   - assistant turn stamped with the takeover sentinel → manager
 *   - assistant turn → agent
 *   - user turn → employee (the portal-side person the agent is talking to)
 */
export function classifyTurn(turn: {
  role: AgentTurnRole;
  content: ContentBlockParam[];
  stopReason: string | null;
}): TurnVoice {
  if (turn.role === "tool") return "tool";
  if (turn.role === "assistant") {
    if (turn.stopReason === HUMAN_TAKEOVER_STOP_REASON) return "manager";
    if (!extractText(turn.content) && hasToolBlock(turn.content)) return "tool";
    return "agent";
  }
  // role === "user": an employee-side message, unless it is tool_result plumbing.
  if (!extractText(turn.content) && hasToolBlock(turn.content)) return "tool";
  return "employee";
}

/**
 * Present one turn for the transcript. `viewerIsAuthor` lets the caller relabel a
 * manager turn the current viewer wrote as "You (manager)".
 */
export function presentTurn(turn: AgentTurn, viewerIsAuthor = false): PresentedTurn {
  const voice = classifyTurn(turn);
  const label = voice === "manager" && viewerIsAuthor ? "You (manager)" : VOICE_LABEL[voice];
  return {
    id: turn.id,
    voice,
    label,
    text: renderTurnText(turn) || "(no message)",
    createdAt: turn.createdAt,
  };
}

/** The transcript: every turn presented, in chronological order. */
export function presentTranscript(turns: AgentTurn[]): PresentedTurn[] {
  return turns.map((t) => presentTurn(t));
}

/* ------------------------------- Thread chrome ------------------------------ */

/** Friendly label for a thread `kind`. Free text in the DB → fall back to raw. */
const KIND_LABEL: Record<string, string> = {
  sick_call: "Sick call",
  schedule_opt: "Schedule generation",
  time_off: "Time-off request",
  agent: "Agent conversation",
};

export function threadKindLabel(kind: string): string {
  return KIND_LABEL[kind] ?? kind.replace(/_/g, " ");
}

/**
 * A compact status descriptor for the list + header: who holds the thread (AI vs
 * a manager) and whether it is still open. `tone` maps to a Badge variant.
 */
export type ThreadStatusBadge = {
  label: string;
  tone: "default" | "secondary" | "outline" | "destructive";
};

export function threadStatusBadge(thread: Pick<AgentThread, "mode" | "status">): ThreadStatusBadge {
  if (thread.status === "closed") return { label: "Resolved", tone: "secondary" };
  if (thread.mode === "human") return { label: "You took over", tone: "destructive" };
  return { label: "AI handling", tone: "outline" };
}
