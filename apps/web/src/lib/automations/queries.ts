import "server-only";

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/observability/logger";
import type {
  Automation,
  AutomationAction,
  AutomationRun,
  AutomationTrigger,
} from "@/lib/automations/types";

export async function listAutomations(orgId: string): Promise<Automation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("automations")
    .select(
      "id, org_id, name, enabled, trigger_type, trigger_config, action_type, action_config, created_at, updated_at",
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) {
    logger.error("automations.list_failed", { err: error, orgId });
    return [];
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    orgId: String(row.org_id),
    name: String(row.name),
    enabled: Boolean(row.enabled),
    triggerType: row.trigger_type as AutomationTrigger,
    triggerConfig: (row.trigger_config ?? {}) as Record<string, unknown>,
    actionType: row.action_type as AutomationAction,
    actionConfig: (row.action_config ?? {}) as Record<string, unknown>,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }));
}

export async function listAutomationRuns(
  orgId: string,
  limit = 30,
): Promise<AutomationRun[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("automation_runs")
    .select(
      "id, org_id, automation_id, event_id, lead_id, status, result, error, started_at, finished_at, created_at",
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    logger.error("automations.runs_list_failed", { err: error, orgId });
    return [];
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    orgId: String(row.org_id),
    automationId: String(row.automation_id),
    eventId: row.event_id ? String(row.event_id) : null,
    leadId: row.lead_id ? String(row.lead_id) : null,
    status: row.status as AutomationRun["status"],
    result: (row.result ?? {}) as Record<string, unknown>,
    error: row.error ? String(row.error) : null,
    startedAt: String(row.started_at),
    finishedAt: row.finished_at ? String(row.finished_at) : null,
    createdAt: String(row.created_at),
  }));
}
