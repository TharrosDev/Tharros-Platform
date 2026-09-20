/**
 * Day 62 — audit-feed presentation. Pure (no `server-only`) so the activity
 * timeline and the Vitest harness both import it. Turns a raw `org_activity_log`
 * row (the union of agent_audit_log + scheduling_audit_log) into a human-readable
 * event: a plain-language title, the actor's voice, and a category for grouping
 * + tone. Unknown action codes degrade gracefully (humanized verbatim) so a new
 * audited action never renders blank.
 */

export type ActivitySource = "agent" | "schedule";

/** Raw row shape returned by the `org_activity_log` RPC (snake_case). */
export type ActivityRow = {
  id: string;
  source: ActivitySource | string;
  actor: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  model: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
};

/** Buckets the timeline colours/filters by. */
export type ActivityCategory = "decision" | "change" | "escalation" | "system";

export type PresentedActivity = {
  id: string;
  source: ActivitySource;
  /** "AI agent" / "Manager" / "Employee" / "System". */
  actorLabel: string;
  /** Plain-language summary, e.g. "Schedule published". */
  title: string;
  category: ActivityCategory;
  /** Model name for an AI model call, if any. */
  model: string | null;
  createdAt: string;
};

/** Map an action code → label + category. Covers every action the app writes. */
const ACTION_META: Record<string, { title: string; category: ActivityCategory }> = {
  // scheduling_audit_log
  "schedule.created": { title: "Schedule draft created", category: "change" },
  "schedule.published": { title: "Schedule published", category: "change" },
  "schedule.cleared": { title: "Schedule cleared", category: "change" },
  "shift.reassigned": { title: "Shift reassigned", category: "change" },
  "candidate_panel.judged": { title: "Schedule candidates judged", category: "decision" },
  "replacement.offered": { title: "Replacement offered", category: "change" },
  "replacement.accepted": { title: "Replacement accepted", category: "change" },
  "replacement.conflict": {
    title: "Replacement declined — scheduling conflict",
    category: "change",
  },
  "replacement.escalated": { title: "Replacement escalated to a manager", category: "escalation" },
  "sick_call.reported": { title: "Sick call reported", category: "change" },
  "time_off.requested": { title: "Time-off requested", category: "change" },
  "shift_swap.requested": { title: "Shift swap requested", category: "change" },
  "shift_swap.approved": { title: "Shift swap approved", category: "change" },
  "shift_swap.applied": { title: "Shift swap applied", category: "change" },
  "shift_swap.declined": { title: "Shift swap declined", category: "change" },
  "shift_swap.denied": { title: "Shift swap denied", category: "change" },
  "shift_swap.escalated": { title: "Shift swap escalated to a manager", category: "escalation" },
  // agent_audit_log
  turn_started: { title: "Agent turn started", category: "system" },
  turn_completed: { title: "Agent turn completed", category: "system" },
  turn_skipped_human: { title: "Agent paused — a manager is handling it", category: "system" },
  turn_skipped_closed: { title: "Agent turn skipped — conversation closed", category: "system" },
  turn_refused: { title: "Agent refused a turn", category: "system" },
  model_call: { title: "AI model call", category: "system" },
  tool_invoked: { title: "Agent used a tool", category: "decision" },
  tool_error: { title: "Agent tool error", category: "escalation" },
  structured_output: { title: "Agent produced structured output", category: "system" },
  takeover: { title: "Manager took over the agent", category: "decision" },
  release: { title: "Conversation handed back to the agent", category: "decision" },
  manual_reply: { title: "Manager replied in the conversation", category: "decision" },
  optimize_started: { title: "Schedule optimization started", category: "decision" },
  optimize_completed: { title: "Schedule optimization completed", category: "decision" },
  solve_attempt: { title: "Solver attempt", category: "system" },
  remedy_applied: { title: "Coverage remedy applied", category: "decision" },
  escalation_emitted: { title: "Agent raised an escalation", category: "escalation" },
  thread_resolved: { title: "Conversation marked resolved", category: "decision" },
  thread_reopened: { title: "Conversation reopened", category: "decision" },
};

/** Humanize an unknown action code: "some_new.action" → "Some new action". */
function humanizeAction(action: string): string {
  const words = action.replace(/[._]/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const ACTOR_LABELS: Record<string, string> = {
  ai: "AI agent",
  agent: "AI agent",
  human: "Manager",
  manager: "Manager",
  employee: "Employee",
  system: "System",
};

export function actorLabel(actor: string): string {
  return ACTOR_LABELS[actor] ?? "System";
}

export function presentActivity(row: ActivityRow): PresentedActivity {
  const meta = ACTION_META[row.action];
  return {
    id: row.id,
    source: row.source === "agent" ? "agent" : "schedule",
    actorLabel: actorLabel(row.actor),
    title: meta?.title ?? humanizeAction(row.action),
    // Unknown actions default to "system" telemetry rather than overclaiming.
    category: meta?.category ?? "system",
    model: row.model,
    createdAt: row.created_at,
  };
}

export function presentActivityFeed(rows: ActivityRow[]): PresentedActivity[] {
  return rows.map(presentActivity);
}
