"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/org/queries";
import { logger } from "@/lib/observability/logger";

import { employeeProfileSchema, type ProfileActionResult } from "./schemas";

/**
 * Day 52 — update an employee's scheduling profile. Owner/admin only: the write
 * goes through the user-session client, so the Day-37/41 owner/admin-write RLS on
 * `employees` is the real gate. Empty optional fields are written as NULL.
 */

function nullableNum(v: number | undefined): number | null {
  return v === undefined ? null : v;
}
function nullableStr(v: string | undefined): string | null {
  return v && v.trim().length > 0 ? v.trim() : null;
}

export async function updateEmployeeProfile(
  employeeId: string,
  payload: unknown,
): Promise<ProfileActionResult> {
  if (!employeeId) return { ok: false, message: "Missing employee." };

  const { activeOrg } = await getOrgContext();
  if (!activeOrg) return { ok: false, message: "No active organization." };

  const parsed = employeeProfileSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Some fields need attention." };
  }
  const p = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("employees")
    .update({
      employment_type: p.employment_type,
      phone: nullableStr(p.phone),
      seniority_rank: nullableNum(p.seniority_rank),
      hire_date: nullableStr(p.hire_date),
      is_minor: p.is_minor,
      target_hours_weekly: nullableNum(p.target_hours_weekly),
      min_hours_weekly: nullableNum(p.min_hours_weekly),
      max_hours_weekly: nullableNum(p.max_hours_weekly),
      performance_score: nullableNum(p.performance_score),
      notes: nullableStr(p.notes),
      updated_at: new Date().toISOString(),
    })
    .eq("id", employeeId)
    .eq("org_id", activeOrg.id);

  if (error) {
    logger.error("updateEmployeeProfile: update failed", { err: error, employeeId });
    return { ok: false, message: "Couldn't save the profile. Please try again." };
  }

  revalidatePath(`/scheduling/employees/${employeeId}`);
  revalidatePath("/scheduling/employees");
  return { ok: true };
}
