/**
 * Day 39 — agent orchestration domain types. Pure (no `server-only`) so the tool
 * registry, mappers, and the runner stay importable by the Vitest harness and by
 * client islands, mirroring lib/jobs/types + lib/assistant/types.
 */

import type { ContentBlockParam, Usage } from "@anthropic-ai/sdk/resources/messages";

/** Whether the AI turn handler runs on a thread, or a human has taken it over. */
export type ThreadMode = "ai" | "human";

export type ThreadStatus = "open" | "closed";

/** A turn's author. 'tool' carries tool_result blocks fed back to Claude. */
export type AgentTurnRole = "user" | "assistant" | "tool";

/** An operational agent conversation, mapped from the DB row to camelCase. */
export type AgentThread = {
  id: string;
  orgId: string;
  createdBy: string | null;
  kind: string;
  title: string;
  mode: ThreadMode;
  status: ThreadStatus;
  takenOverBy: string | null;
  takenOverAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** One turn of an agent thread. `content` is the raw Anthropic content-block array. */
export type AgentTurn = {
  id: string;
  threadId: string;
  orgId: string;
  role: AgentTurnRole;
  content: ContentBlockParam[];
  stopReason: string | null;
  usage: Usage | null;
  createdAt: string;
};

/** Audit actors + a non-exhaustive set of audited actions. `action` is free text. */
export type AgentAuditActor = "ai" | "human" | "system";

export type AgentAuditAction =
  | "turn_started"
  | "turn_skipped_human"
  | "turn_skipped_closed"
  | "model_call"
  | "tool_invoked"
  | "tool_error"
  | "turn_completed"
  | "structured_output"
  | "takeover"
  | "release"
  // Day 48 — scheduling optimize-loop steps.
  | "optimize_started"
  | "solve_attempt"
  | "remedy_applied"
  | "escalation_emitted"
  | "optimize_completed"
  | (string & {});

export type AgentAuditEvent = {
  orgId: string;
  threadId?: string | null;
  turnId?: string | null;
  actor: AgentAuditActor;
  action: AgentAuditAction;
  model?: string | null;
  detail?: Record<string, unknown>;
};

/** The raw PostgREST row shape (snake_case) for ai_conversation_threads. */
export type AgentThreadRow = {
  id: string;
  org_id: string;
  created_by: string | null;
  kind: string;
  title: string;
  mode: ThreadMode;
  status: ThreadStatus;
  taken_over_by: string | null;
  taken_over_at: string | null;
  created_at: string;
  updated_at: string;
};

export function mapThread(row: AgentThreadRow): AgentThread {
  return {
    id: row.id,
    orgId: row.org_id,
    createdBy: row.created_by,
    kind: row.kind,
    title: row.title,
    mode: row.mode,
    status: row.status,
    takenOverBy: row.taken_over_by,
    takenOverAt: row.taken_over_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** The raw PostgREST row shape (snake_case) for agent_turns. */
export type AgentTurnRow = {
  id: string;
  thread_id: string;
  org_id: string;
  role: AgentTurnRole;
  content: ContentBlockParam[] | null;
  stop_reason: string | null;
  usage: Usage | null;
  created_at: string;
};

export function mapTurn(row: AgentTurnRow): AgentTurn {
  return {
    id: row.id,
    threadId: row.thread_id,
    orgId: row.org_id,
    role: row.role,
    content: row.content ?? [],
    stopReason: row.stop_reason,
    usage: row.usage,
    createdAt: row.created_at,
  };
}
