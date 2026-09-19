import type { SupabaseClient } from "@supabase/supabase-js";

import {
  AUTOMATION_RUN_STALE_MS,
  canExecuteAutomations,
  canReclaimAutomationRun,
} from "@/lib/automations/eligibility";
import { matchesAutomationEvent } from "@/lib/automations/match";
import type { Job, JobHandler } from "@/lib/jobs/types";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/leads/types";
import { logger } from "@/lib/observability/logger";

function isLeadStatus(value: unknown): value is LeadStatus {
  return typeof value === "string" && (LEAD_STATUSES as readonly string[]).includes(value);
}

type RunTerminalStatus = "succeeded" | "failed" | "skipped";

async function acquireRun(
  admin: SupabaseClient,
  input: {
    orgId: string;
    automationId: string;
    eventId: string;
    leadId: string;
  },
): Promise<string | null> {
  const { data, error } = await admin
    .from("automation_runs")
    .insert({
      org_id: input.orgId,
      automation_id: input.automationId,
      event_id: input.eventId,
      lead_id: input.leadId,
      status: "running",
    })
    .select("id")
    .single();

  if (!error) return (data as { id: string }).id;
  if (error.code !== "23505") throw error;

  const { data: existing, error: existingError } = await admin
    .from("automation_runs")
    .select("id, status, started_at")
    .eq("automation_id", input.automationId)
    .eq("event_id", input.eventId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (!existing) throw new Error("Automation run conflict could not be resolved");
  if (existing.status === "succeeded" || existing.status === "skipped") return null;
  if (!canReclaimAutomationRun(existing)) return null;

  const now = Date.now();
  const patch = {
    status: "running",
    result: {},
    error: null,
    started_at: new Date(now).toISOString(),
    finished_at: null,
  };

  let reclaimQuery = admin
    .from("automation_runs")
    .update(patch)
    .eq("id", existing.id);

  // Make the lease acquisition itself conditional. The earlier read decides
  // whether a retry is eligible; these predicates ensure two overlapping
  // workers cannot both reclaim the same failed/stale run.
  reclaimQuery =
    existing.status === "failed"
      ? reclaimQuery.eq("status", "failed")
      : reclaimQuery
          .eq("status", "running")
          .lte("started_at", new Date(now - AUTOMATION_RUN_STALE_MS).toISOString());

  const { data: reclaimed, error: reclaimError } = await reclaimQuery
    .select("id")
    .maybeSingle();
  if (reclaimError) throw reclaimError;
  return reclaimed ? String(reclaimed.id) : null;
}

async function finishRun(
  admin: SupabaseClient,
  runId: string,
  status: RunTerminalStatus,
  result: Record<string, unknown>,
  errorMessage: string | null,
): Promise<void> {
  const { error } = await admin
    .from("automation_runs")
    .update({
      status,
      result,
      error: errorMessage,
      finished_at: new Date().toISOString(),
    })
    .eq("id", runId);
  if (error) throw error;
}

export const automationDispatchHandler: JobHandler = async (job: Job) => {
  const eventId = typeof job.payload.eventId === "string" ? job.payload.eventId : null;
  const targetAutomationId =
    typeof job.payload.automationId === "string" ? job.payload.automationId : null;
  const manual = job.payload.manual === true;
  if (!eventId) throw new Error("automation-dispatch missing eventId");

  const [{ createAdminClient }, { createNotification }] = await Promise.all([
    import("@/lib/supabase/admin"),
    import("@/lib/notifications/notify"),
  ]);
  const admin = createAdminClient();

  const { data: eventData, error: eventError } = await admin
    .from("lead_events")
    .select("id, org_id, lead_id, type, data")
    .eq("id", eventId)
    .maybeSingle();
  if (eventError) throw eventError;
  if (!eventData) return;

  const event = eventData as {
    id: string;
    org_id: string;
    lead_id: string;
    type: string;
    data: Record<string, unknown> | null;
  };

  const { data: subscription, error: subscriptionError } = await admin
    .from("subscriptions")
    .select("status, tier")
    .eq("org_id", event.org_id)
    .maybeSingle();
  if (subscriptionError) throw subscriptionError;
  if (!canExecuteAutomations(subscription)) {
    logger.info("automations.dispatch_not_entitled", {
      orgId: event.org_id,
      eventId: event.id,
    });
    return;
  }

  const { data: leadData, error: leadError } = await admin
    .from("leads")
    .select("id, name, email, phone, status")
    .eq("id", event.lead_id)
    .eq("org_id", event.org_id)
    .maybeSingle();
  if (leadError) throw leadError;
  if (!leadData) return;

  const lead = leadData as {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    status: LeadStatus;
  };

  let automationQuery = admin
    .from("automations")
    .select("id, name, trigger_type, trigger_config, action_type, action_config")
    .eq("org_id", event.org_id)
    .eq("enabled", true);

  automationQuery = targetAutomationId
    ? automationQuery.eq("id", targetAutomationId)
    : automationQuery.eq("trigger_type", event.type);

  const { data: automationRows, error: automationError } = await automationQuery;
  if (automationError) throw automationError;

  const failures: unknown[] = [];

  for (const row of automationRows ?? []) {
    const automation = row as {
      id: string;
      name: string;
      trigger_type: string;
      trigger_config: Record<string, unknown> | null;
      action_type: string;
      action_config: Record<string, unknown> | null;
    };

    if (
      !matchesAutomationEvent({
        manual,
        eventType: event.type,
        eventData: event.data,
        triggerType: automation.trigger_type as "lead.created" | "lead.status_changed",
        triggerConfig: automation.trigger_config,
      })
    ) {
      continue;
    }

    const runId = await acquireRun(admin, {
      orgId: event.org_id,
      automationId: automation.id,
      eventId: event.id,
      leadId: lead.id,
    });
    if (!runId) continue;

    try {
      let result: Record<string, unknown> = {};
      let terminalStatus: "succeeded" | "skipped" = "succeeded";
      const action = automation.action_config ?? {};

      if (automation.action_type === "notify_team") {
        const { data: managers, error: managerError } = await admin
          .from("memberships")
          .select("user_id")
          .eq("org_id", event.org_id)
          .in("role", ["owner", "admin"]);
        if (managerError) throw managerError;

        const email = action.email === true;
        await Promise.all(
          (managers ?? []).map((manager) =>
            createNotification(admin, {
              orgId: event.org_id,
              userId: String(manager.user_id),
              type: "system",
              title: `Automation: ${automation.name}`,
              body: `${lead.name} matched ${automation.name}.`,
              data: { url: `/leads/${lead.id}`, label: "Open lead", leadId: lead.id },
              email,
            }),
          ),
        );
        result = { notified: (managers ?? []).length, email };
      } else if (automation.action_type === "set_lead_status") {
        if (!isLeadStatus(action.status)) {
          throw new Error("Automation has an invalid target status");
        }

        const previousStatus = lead.status;
        if (previousStatus !== action.status) {
          const patch: Record<string, unknown> = { status: action.status };
          if (action.status === "contacted") patch.last_contacted_at = new Date().toISOString();

          const { error: updateError } = await admin
            .from("leads")
            .update(patch)
            .eq("id", lead.id)
            .eq("org_id", event.org_id);
          if (updateError) throw updateError;

          const { error: eventInsertError } = await admin.from("lead_events").insert({
            org_id: event.org_id,
            lead_id: lead.id,
            type: "automation.action",
            data: {
              automationId: automation.id,
              action: "set_lead_status",
              from: previousStatus,
              to: action.status,
            },
          });
          if (eventInsertError) throw eventInsertError;
          lead.status = action.status;
        }
        result = { from: previousStatus, to: action.status };
      } else if (automation.action_type === "draft_follow_up") {
        if (!lead.email) {
          terminalStatus = "skipped";
          result = { reason: "lead_has_no_email" };
        } else {
          const [{ checkOrgQueryCap }, { generateLeadFollowUpDraft }] = await Promise.all([
            import("@/lib/billing/usage"),
            import("@/lib/leads/follow-up"),
          ]);
          const cap = await checkOrgQueryCap(event.org_id);
          if (!cap.allowed) {
            terminalStatus = "skipped";
            result = { reason: "ai_usage_cap_reached" };
          } else {
            await generateLeadFollowUpDraft({
              orgId: event.org_id,
              leadId: lead.id,
              userId: null,
            });
            result = { drafted: true };
          }
        }
      } else {
        throw new Error(`Unsupported automation action "${automation.action_type}"`);
      }

      await finishRun(admin, runId, terminalStatus, result, null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown automation error";
      try {
        await finishRun(admin, runId, "failed", {}, message);
        failures.push(err instanceof Error ? err : new Error(message));
      } catch (persistErr) {
        failures.push(
          new AggregateError(
            [err, persistErr],
            `Automation failed and its run state could not be persisted: ${message}`,
          ),
        );
      }
    }
  }

  if (failures.length) {
    throw new AggregateError(
      failures,
      `${failures.length} automation run(s) failed and require retry`,
    );
  }
};
