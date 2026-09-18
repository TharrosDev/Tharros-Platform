import type { Job, JobHandler } from "@/lib/jobs/types";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/leads/types";

function isLeadStatus(value: unknown): value is LeadStatus {
  return typeof value === "string" && (LEAD_STATUSES as readonly string[]).includes(value);
}

export const automationDispatchHandler: JobHandler = async (job: Job) => {
  const eventId = typeof job.payload.eventId === "string" ? job.payload.eventId : null;
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

  const { data: automationRows, error: automationError } = await admin
    .from("automations")
    .select("id, name, trigger_type, trigger_config, action_type, action_config")
    .eq("org_id", event.org_id)
    .eq("enabled", true)
    .eq("trigger_type", event.type);
  if (automationError) throw automationError;

  for (const row of automationRows ?? []) {
    const automation = row as {
      id: string;
      name: string;
      trigger_type: string;
      trigger_config: Record<string, unknown> | null;
      action_type: string;
      action_config: Record<string, unknown> | null;
    };

    const trigger = automation.trigger_config ?? {};
    if (
      event.type === "lead.status_changed" &&
      typeof trigger.toStatus === "string" &&
      trigger.toStatus !== event.data?.to
    ) {
      continue;
    }

    const { data: runData, error: runError } = await admin
      .from("automation_runs")
      .insert({
        org_id: event.org_id,
        automation_id: automation.id,
        event_id: event.id,
        lead_id: lead.id,
        status: "running",
      })
      .select("id")
      .single();

    if (runError) {
      if ((runError as { code?: string }).code === "23505") continue;
      throw runError;
    }

    const runId = (runData as { id: string }).id;

    try {
      let result: Record<string, unknown> = {};
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
              data: { url: "/leads", label: "Open leads", leadId: lead.id },
              email,
            }),
          ),
        );
        result = { notified: (managers ?? []).length, email };
      } else if (automation.action_type === "set_lead_status") {
        if (!isLeadStatus(action.status)) throw new Error("Automation has an invalid target status");

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

          await admin.from("lead_events").insert({
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
        }
        result = { from: previousStatus, to: action.status };
      } else {
        throw new Error(`Unsupported automation action "${automation.action_type}"`);
      }

      await admin
        .from("automation_runs")
        .update({
          status: "succeeded",
          result,
          error: null,
          finished_at: new Date().toISOString(),
        })
        .eq("id", runId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown automation error";
      await admin
        .from("automation_runs")
        .update({
          status: "failed",
          error: message,
          finished_at: new Date().toISOString(),
        })
        .eq("id", runId);
    }
  }
};
