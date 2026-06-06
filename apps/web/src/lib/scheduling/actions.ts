"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/org/queries";
import { logger } from "@/lib/observability/logger";

import { DEFAULT_LABOR_RULE_PARAMS, LABOR_RULE_PRESETS } from "./presets";
import { schedulingSetupSchema, type LaborSelection, type SchedulingSetupState } from "./schemas";
import type { LaborRuleParams } from "./types";

/**
 * Day 43 — persist the scheduling onboarding wizard. The client posts the whole
 * payload as JSON in a hidden `payload` field; we validate it, resolve the labor
 * params from the Day-42 presets server-side, and hand everything to the
 * transactional, owner/admin-gated `complete_scheduling_setup` RPC.
 */

/** Resolve the labor ruleset the RPC stores: a preset, or custom overrides on the default. */
function resolveLaborParams(labor: LaborSelection): LaborRuleParams & { preset: string } {
  if (labor.preset === "custom") {
    const c = labor.custom;
    return {
      preset: "custom",
      ...DEFAULT_LABOR_RULE_PARAMS,
      max_daily_hours: c?.max_daily_hours ?? DEFAULT_LABOR_RULE_PARAMS.max_daily_hours,
      max_weekly_hours: c?.max_weekly_hours ?? DEFAULT_LABOR_RULE_PARAMS.max_weekly_hours,
      min_rest_hours_between_shifts:
        c?.min_rest_hours_between_shifts ?? DEFAULT_LABOR_RULE_PARAMS.min_rest_hours_between_shifts,
      overtime_threshold_weekly:
        c?.overtime_threshold_weekly ?? DEFAULT_LABOR_RULE_PARAMS.overtime_threshold_weekly,
      max_consecutive_days:
        c?.max_consecutive_days ?? DEFAULT_LABOR_RULE_PARAMS.max_consecutive_days,
    };
  }
  return { preset: labor.preset, ...LABOR_RULE_PRESETS[labor.preset] };
}

export async function completeSchedulingSetup(
  _prev: SchedulingSetupState,
  formData: FormData,
): Promise<SchedulingSetupState> {
  const { activeOrg } = await getOrgContext();
  if (!activeOrg) {
    return { message: "No active organization. Try refreshing the page." };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("payload") ?? "{}"));
  } catch {
    return { message: "Could not read the form. Please try again." };
  }

  const parsed = schedulingSetupSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { message: first?.message ?? "Some fields need attention." };
  }

  const { employees, businessHours, staffing, labor, persona } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_scheduling_setup", {
    p_org: activeOrg.id,
    p_employees: employees,
    p_business_hours: businessHours,
    p_staffing: staffing,
    p_labor: resolveLaborParams(labor),
    p_persona: persona,
  });

  if (error) {
    logger.error("completeSchedulingSetup: RPC failed", { err: error, orgId: activeOrg.id });
    return { message: error.message };
  }

  revalidatePath("/scheduling");
  redirect("/scheduling");
}
