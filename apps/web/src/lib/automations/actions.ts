"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getAuthUser } from "@/lib/auth/current-user";
import { getFeatureAccess } from "@/lib/billing/entitlements";
import { getOrgContext } from "@/lib/org/queries";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enqueueJob } from "@/lib/jobs/enqueue";
import { recordLeadEvent } from "@/lib/leads/events";
import { LEAD_STATUSES } from "@/lib/leads/types";
import { AUTOMATION_ACTIONS, AUTOMATION_TRIGGERS } from "@/lib/automations/types";
import { logger } from "@/lib/observability/logger";

const automationFormSchema = z.object({
  name: z.string().trim().min(1).max(120),
  triggerType: z.enum(AUTOMATION_TRIGGERS),
  triggerStatus: z.enum(LEAD_STATUSES).optional(),
  actionType: z.enum(AUTOMATION_ACTIONS),
  actionStatus: z.enum(LEAD_STATUSES).optional(),
  email: z.boolean(),
});

function parseAutomationForm(formData: FormData) {
  return automationFormSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    triggerType: String(formData.get("triggerType") ?? ""),
    triggerStatus: String(formData.get("triggerStatus") ?? "") || undefined,
    actionType: String(formData.get("actionType") ?? ""),
    actionStatus: String(formData.get("actionStatus") ?? "") || undefined,
    email: formData.get("email") === "on",
  });
}

function automationConfig(data: z.infer<typeof automationFormSchema>): {
  triggerConfig: Record<string, unknown>;
  actionConfig: Record<string, unknown>;
} {
  const triggerConfig =
    data.triggerType === "lead.status_changed" && data.triggerStatus
      ? { toStatus: data.triggerStatus }
      : {};

  let actionConfig: Record<string, unknown> = {};
  if (data.actionType === "notify_team") actionConfig = { email: data.email };
  if (data.actionType === "set_lead_status") actionConfig = { status: data.actionStatus };

  return { triggerConfig, actionConfig };
}

async function requireAutomationManager() {
  const [user, { activeOrg }, access] = await Promise.all([
    getAuthUser(),
    getOrgContext(),
    getFeatureAccess("automations"),
  ]);
  if (!user || !activeOrg) redirect("/login");
  if (!access.entitled) redirect("/billing");
  if (activeOrg.role === "member") redirect("/automations?error=permission");
  return { user, activeOrg };
}

export async function createAutomation(formData: FormData): Promise<void> {
  const { user, activeOrg } = await requireAutomationManager();
  const parsed = parseAutomationForm(formData);

  if (!parsed.success) redirect("/automations?error=invalid");
  if (parsed.data.actionType === "set_lead_status" && !parsed.data.actionStatus) {
    redirect("/automations?error=missing-action-status");
  }

  const { triggerConfig, actionConfig } = automationConfig(parsed.data);
  const supabase = await createClient();
  const { error } = await supabase.from("automations").insert({
    org_id: activeOrg.id,
    name: parsed.data.name,
    enabled: true,
    trigger_type: parsed.data.triggerType,
    trigger_config: triggerConfig,
    action_type: parsed.data.actionType,
    action_config: actionConfig,
    created_by: user.id,
  });

  if (error) {
    logger.error("automations.create_failed", { err: error, orgId: activeOrg.id });
    redirect("/automations?error=create");
  }

  revalidatePath("/automations");
  redirect("/automations?created=1");
}

export async function updateAutomation(formData: FormData): Promise<void> {
  const { activeOrg } = await requireAutomationManager();
  const automationId = String(formData.get("automationId") ?? "");
  const parsed = parseAutomationForm(formData);

  if (!automationId || !parsed.success) redirect("/automations?error=invalid");
  if (parsed.data.actionType === "set_lead_status" && !parsed.data.actionStatus) {
    redirect("/automations?error=missing-action-status");
  }

  const { triggerConfig, actionConfig } = automationConfig(parsed.data);
  const supabase = await createClient();
  const { error } = await supabase
    .from("automations")
    .update({
      name: parsed.data.name,
      trigger_type: parsed.data.triggerType,
      trigger_config: triggerConfig,
      action_type: parsed.data.actionType,
      action_config: actionConfig,
    })
    .eq("id", automationId)
    .eq("org_id", activeOrg.id);

  if (error) {
    logger.error("automations.update_failed", {
      err: error,
      automationId,
      orgId: activeOrg.id,
    });
    redirect("/automations?error=update");
  }

  revalidatePath("/automations");
}

export async function toggleAutomation(formData: FormData): Promise<void> {
  const { activeOrg } = await requireAutomationManager();
  const id = String(formData.get("automationId") ?? "");
  const enabled = String(formData.get("enabled") ?? "") === "true";
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("automations")
    .update({ enabled })
    .eq("id", id)
    .eq("org_id", activeOrg.id);

  if (error) logger.error("automations.toggle_failed", { err: error, id });
  revalidatePath("/automations");
}

export async function deleteAutomation(formData: FormData): Promise<void> {
  const { activeOrg } = await requireAutomationManager();
  const id = String(formData.get("automationId") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("automations")
    .delete()
    .eq("id", id)
    .eq("org_id", activeOrg.id);

  if (error) logger.error("automations.delete_failed", { err: error, id });
  revalidatePath("/automations");
}

export async function runAutomationNow(formData: FormData): Promise<void> {
  const { user, activeOrg } = await requireAutomationManager();
  const automationId = String(formData.get("automationId") ?? "");
  const leadId = String(formData.get("leadId") ?? "");
  if (!automationId || !leadId) redirect("/automations?error=manual-run");

  const supabase = await createClient();
  const [{ data: automation }, { data: lead }] = await Promise.all([
    supabase
      .from("automations")
      .select("id")
      .eq("id", automationId)
      .eq("org_id", activeOrg.id)
      .maybeSingle(),
    supabase.from("leads").select("id").eq("id", leadId).eq("org_id", activeOrg.id).maybeSingle(),
  ]);

  if (!automation || !lead) redirect("/automations?error=manual-run");

  const admin = createAdminClient();
  const eventId = await recordLeadEvent(admin, {
    orgId: activeOrg.id,
    leadId,
    type: "automation.action",
    data: {
      action: "manual_run_requested",
      automationId,
    },
    actorUserId: user.id,
    dispatch: false,
  });

  await enqueueJob(admin, {
    type: "automation-dispatch",
    payload: { eventId, automationId, manual: true },
    orgId: activeOrg.id,
  });

  revalidatePath("/automations");
  revalidatePath(`/leads/${leadId}`);
  redirect("/automations?queued=1");
}
