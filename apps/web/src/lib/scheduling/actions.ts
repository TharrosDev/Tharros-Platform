"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/org/queries";
import { logger } from "@/lib/observability/logger";

import { DEFAULT_LABOR_RULE_PARAMS, LABOR_RULE_PRESETS } from "./presets";
import {
  permanentAvailabilitySchema,
  schedulingSetupSchema,
  temporaryOverrideSchema,
  type AvailabilityState,
  type LaborSelection,
  type SchedulingSetupState,
} from "./schemas";
import type { LaborRuleParams } from "./types";

/** Null out empty-string time/date form values so they hit the DB as NULL. */
function nullable(v: string | undefined): string | null {
  return v && v.length > 0 ? v : null;
}

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

/* ---------------------------------------------------------------------------
 * Day 44 — manager availability edits. Direct table writes via the user-session
 * client; the Day-41 owner/admin-write RLS on `availability` enforces the gate.
 * Whitelist model: only days toggled available are stored as permanent rows.
 * ------------------------------------------------------------------------- */

/** Replace an employee's permanent weekly availability with the submitted grid. */
export async function savePermanentAvailability(
  _prev: AvailabilityState,
  formData: FormData,
): Promise<AvailabilityState> {
  const { activeOrg } = await getOrgContext();
  if (!activeOrg) return { message: "No active organization. Try refreshing the page." };

  const employeeId = String(formData.get("employeeId") ?? "");
  if (!employeeId) return { message: "Missing employee." };

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("entries") ?? "[]"));
  } catch {
    return { message: "Could not read the form. Please try again." };
  }
  const parsed = permanentAvailabilitySchema.safeParse(raw);
  if (!parsed.success) {
    return { message: parsed.error.issues[0]?.message ?? "Some fields need attention." };
  }

  const supabase = await createClient();
  // Replace the permanent rows for this employee (delete then insert the
  // workable days). N ≤ 7, manager-gated by RLS.
  const del = await supabase
    .from("availability")
    .delete()
    .eq("employee_id", employeeId)
    .eq("kind", "permanent");
  if (del.error) {
    logger.error("savePermanentAvailability: delete failed", {
      err: del.error,
      orgId: activeOrg.id,
      employeeId,
    });
    return { message: del.error.message };
  }

  const workable = parsed.data.filter((d) => d.is_available);
  if (workable.length > 0) {
    const ins = await supabase.from("availability").insert(
      workable.map((d) => ({
        org_id: activeOrg.id,
        employee_id: employeeId,
        kind: "permanent",
        day_of_week: d.day_of_week,
        is_available: true,
        start_time: nullable(d.start_time),
        end_time: nullable(d.end_time),
      })),
    );
    if (ins.error) {
      logger.error("savePermanentAvailability: insert failed", {
        err: ins.error,
        orgId: activeOrg.id,
        employeeId,
      });
      return { message: ins.error.message };
    }
  }

  revalidatePath("/scheduling/availability");
  return { ok: true, message: "Weekly availability saved." };
}

/** Add one temporary, dated availability override for an employee. */
export async function addTemporaryOverride(
  _prev: AvailabilityState,
  formData: FormData,
): Promise<AvailabilityState> {
  const { activeOrg } = await getOrgContext();
  if (!activeOrg) return { message: "No active organization. Try refreshing the page." };

  const employeeId = String(formData.get("employeeId") ?? "");
  if (!employeeId) return { message: "Missing employee." };

  const parsed = temporaryOverrideSchema.safeParse({
    effective_date: String(formData.get("effective_date") ?? ""),
    end_date: String(formData.get("end_date") ?? ""),
    is_available: formData.get("is_available") === "true",
    start_time: String(formData.get("start_time") ?? ""),
    end_time: String(formData.get("end_time") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  });
  if (!parsed.success) {
    return { message: parsed.error.issues[0]?.message ?? "Some fields need attention." };
  }
  const o = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("availability").insert({
    org_id: activeOrg.id,
    employee_id: employeeId,
    kind: "temporary",
    effective_date: o.effective_date,
    end_date: nullable(o.end_date),
    is_available: o.is_available,
    start_time: nullable(o.start_time),
    end_time: nullable(o.end_time),
    notes: o.notes && o.notes.length > 0 ? o.notes : null,
  });
  if (error) {
    logger.error("addTemporaryOverride: insert failed", {
      err: error,
      orgId: activeOrg.id,
      employeeId,
    });
    return { message: error.message };
  }

  revalidatePath("/scheduling/availability");
  return { ok: true, message: "Override added." };
}

/** Delete one availability row (permanent or temporary) by id. RLS-scoped. */
export async function removeAvailabilityRow(id: string): Promise<{ error?: string }> {
  if (!id) return { error: "Missing row." };
  const supabase = await createClient();
  const { error } = await supabase.from("availability").delete().eq("id", id);
  if (error) {
    logger.error("removeAvailabilityRow: delete failed", { err: error, id });
    return { error: error.message };
  }
  revalidatePath("/scheduling/availability");
  return {};
}
