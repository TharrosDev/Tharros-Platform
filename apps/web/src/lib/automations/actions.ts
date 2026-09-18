"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getAuthUser } from "@/lib/auth/current-user";
import { getFeatureAccess } from "@/lib/billing/entitlements";
import { getOrgContext } from "@/lib/org/queries";
import { createClient } from "@/lib/supabase/server";
import { LEAD_STATUSES } from "@/lib/leads/types";
import {
  AUTOMATION_ACTIONS,
  AUTOMATION_TRIGGERS,
} from "@/lib/automations/types";
import { logger } from "@/lib/observability/logger";

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
  const parsed = z
    .object({
      name: z.string().trim().min(1).max(120),
      triggerType: z.enum(AUTOMATION_TRIGGERS),
      triggerStatus: z.enum(LEAD_STATUSES).optional(),
      actionType: z.enum(AUTOMATION_ACTIONS),
      actionStatus: z.enum(LEAD_STATUSES).optional(),
      email: z.boolean(),
    })
    .safeParse({
      name: String(formData.get("name") ?? ""),
      triggerType: String(formData.get("triggerType") ?? ""),
      triggerStatus: String(formData.get("triggerStatus") ?? "") || undefined,
      actionType: String(formData.get("actionType") ?? ""),
      actionStatus: String(formData.get("actionStatus") ?? "") || undefined,
      email: formData.get("email") === "on",
    });

  if (!parsed.success) redirect("/automations?error=invalid");
  if (parsed.data.actionType === "set_lead_status" && !parsed.data.actionStatus) {
    redirect("/automations?error=missing-action-status");
  }

  const triggerConfig =
    parsed.data.triggerType === "lead.status_changed" && parsed.data.triggerStatus
      ? { toStatus: parsed.data.triggerStatus }
      : {};
  const actionConfig =
    parsed.data.actionType === "notify_team"
      ? { email: parsed.data.email }
      : { status: parsed.data.actionStatus };

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
