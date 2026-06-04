import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/observability/logger";
import type { AgentAuditEvent } from "@/lib/agents/types";

/**
 * Day 39 — agent decision audit trail. Every AI decision on a thread (turn
 * started, model call, tool invoked, takeover, completion) is recorded to the
 * deny-all `agent_audit_log` table via the service-role admin client (its only
 * writer, mirroring recordUsage → ai_usage_events).
 *
 * Best-effort: an audit failure must never break a turn, so a write error is
 * logged and swallowed. The admin client is injected (DI) so this stays
 * importable by the Vitest harness.
 */
export async function recordAuditEvent(
  admin: SupabaseClient,
  event: AgentAuditEvent,
): Promise<void> {
  try {
    const { error } = await admin.from("agent_audit_log").insert({
      org_id: event.orgId,
      thread_id: event.threadId ?? null,
      turn_id: event.turnId ?? null,
      actor: event.actor,
      action: event.action,
      model: event.model ?? null,
      detail: event.detail ?? {},
    });
    if (error) {
      logger.warn("agents.audit_failed", { action: event.action, err: error });
    }
  } catch (err) {
    logger.warn("agents.audit_failed", { action: event.action, err });
  }
}
