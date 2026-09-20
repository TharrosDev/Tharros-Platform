"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/org/queries";
import { logger } from "@/lib/observability/logger";

import { roleAssignmentSchema, roleCertificationSchema, type ProfileActionResult } from "./schemas";

/**
 * Day 52 — manage an employee's role/certification assignments + the org catalog.
 * Owner/admin only: writes go through the user-session client, gated by the Day-41
 * owner/admin-write RLS on `roles_certifications` + `employee_role_assignments`.
 */

/** Assign a catalog role/cert to an employee (idempotent on the unique pair). */
export async function assignRole(payload: unknown): Promise<ProfileActionResult> {
  const { activeOrg } = await getOrgContext();
  if (!activeOrg) return { ok: false, message: "No active organization." };

  const parsed = roleAssignmentSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Pick a role." };
  }
  const { employeeId, roleCertificationId, expiresAt } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("employee_role_assignments").upsert(
    {
      org_id: activeOrg.id,
      employee_id: employeeId,
      role_certification_id: roleCertificationId,
      expires_at: expiresAt && expiresAt.length > 0 ? expiresAt : null,
    },
    { onConflict: "employee_id,role_certification_id" },
  );
  if (error) {
    logger.error("assignRole: upsert failed", { err: error, employeeId });
    return { ok: false, message: "Couldn't assign the role. Please try again." };
  }

  revalidatePath(`/scheduling/employees/${employeeId}`);
  return { ok: true };
}

/** Remove a role assignment by its id. */
export async function removeRoleAssignment(
  assignmentId: string,
  employeeId: string,
): Promise<ProfileActionResult> {
  if (!assignmentId) return { ok: false, message: "Missing assignment." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("employee_role_assignments")
    .delete()
    .eq("id", assignmentId);
  if (error) {
    logger.error("removeRoleAssignment: delete failed", { err: error, assignmentId });
    return { ok: false, message: "Couldn't remove the role. Please try again." };
  }

  revalidatePath(`/scheduling/employees/${employeeId}`);
  return { ok: true };
}

/**
 * Create a new role/certification in the org catalog. Returns the new id so the
 * client can immediately assign it. Owner/admin only (RLS).
 */
export async function createRoleCertification(
  payload: unknown,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const { activeOrg } = await getOrgContext();
  if (!activeOrg) return { ok: false, message: "No active organization." };

  const parsed = roleCertificationSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Enter a name." };
  }
  const { name, kind, description } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("roles_certifications")
    .insert({
      org_id: activeOrg.id,
      name,
      kind,
      description: description && description.length > 0 ? description : null,
    })
    .select("id")
    .single();
  if (error || !data) {
    // The catalog has a unique (org, lower(name), kind) index — surface a clean message.
    const dup = error?.code === "23505";
    logger.error("createRoleCertification: insert failed", { err: error, orgId: activeOrg.id });
    return {
      ok: false,
      message: dup ? "That role already exists." : "Couldn't create the role. Please try again.",
    };
  }

  revalidatePath("/scheduling/employees");
  return { ok: true, id: data.id as string };
}
