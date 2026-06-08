"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/current-user";
import { getOrgContext } from "@/lib/org/queries";
import { getURL } from "@/lib/site-url";
import { sendEmail } from "@/lib/email/send";
import { checkRateLimit } from "@/lib/rate-limit";
import { PortalAccessEmail } from "@/lib/email/templates/portal-access";
import { employeeSchema, type EmployeeFormState } from "@/lib/employees/schemas";

/**
 * Day 37 — employee roster server actions. `createEmployee` is a plain table
 * write gated by the Day-37 employees RLS (owner/admin insert). `sendPortalLink`
 * mints/rotates a token via the SECURITY DEFINER `issue_portal_token` RPC and
 * emails the magic-link. Removal rides the employees DELETE policy. Every action
 * revalidates /settings/employees so the roster refreshes.
 */

const EMPLOYEES_PATH = "/scheduling/employees";

function fieldErrors(error: z.ZodError) {
  return z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
}

/** The portal magic-link the employee opens (validated + cookie-set server-side). */
function portalUrlFor(token: string): string {
  return `${getURL()}/portal/enter?token=${encodeURIComponent(token)}`;
}

/** Add an account-less employee to the active org's roster. Owner/admin only. */
export async function createEmployee(
  _prev: EmployeeFormState,
  formData: FormData,
): Promise<EmployeeFormState> {
  const raw = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
  };
  const parsed = employeeSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error), values: raw };
  }

  const { activeOrg } = await getOrgContext();
  if (!activeOrg) {
    return { message: "No active organization. Try refreshing the page.", values: raw };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("employees").insert({
    org_id: activeOrg.id,
    name: parsed.data.name,
    email: parsed.data.email,
  });
  if (error) {
    return { message: error.message, values: raw };
  }

  revalidatePath(EMPLOYEES_PATH);
  return { ok: true, message: `${parsed.data.name} added to the roster.` };
}

/**
 * Issue (or rotate) the employee's portal token and email them the magic-link.
 * Owner/admin only — the RPC self-guards on role. Rotating invalidates any prior
 * link, so this doubles as "resend".
 */
export async function sendPortalLink(employeeId: string): Promise<{ error?: string }> {
  if (!employeeId) return { error: "Missing employee." };

  const [user, { activeOrg }] = await Promise.all([getAuthUser(), getOrgContext()]);
  if (!user || !activeOrg) return { error: "Not authenticated." };

  // Throttle per manager to cap Resend-quota abuse (reuses the Day-15 limiter).
  const { allowed } = await checkRateLimit(`portal-link:${user.id}`, 30, 3600);
  if (!allowed) return { error: "You're sending links too quickly. Please try again later." };

  const supabase = await createClient();

  // Read the employee (RLS-scoped) for the email greeting before minting the token.
  const { data: employee, error: readErr } = await supabase
    .from("employees")
    .select("name, email")
    .eq("id", employeeId)
    .maybeSingle();
  if (readErr) return { error: readErr.message };
  if (!employee) return { error: "Employee not found." };

  const { data: token, error: rpcErr } = await supabase.rpc("issue_portal_token", {
    p_employee_id: employeeId,
  });
  if (rpcErr) return { error: rpcErr.message };
  if (!token) return { error: "Could not create the portal link. Please try again." };

  const emp = employee as { name: string; email: string };
  const sent = await sendEmail({
    to: emp.email,
    subject: `Your ${activeOrg.name} schedule access`,
    react: PortalAccessEmail({
      employeeName: emp.name,
      orgName: activeOrg.name,
      portalUrl: portalUrlFor(token as string),
    }),
  });

  revalidatePath(EMPLOYEES_PATH);

  if (!sent.ok) {
    // The token exists; only the email failed. Tell the truth so they can resend.
    return { error: `Portal link created, but the email failed to send (${sent.error}).` };
  }
  return {};
}

/** Remove an employee from the roster (cascades their portal tokens). Owner/admin only. */
export async function removeEmployee(employeeId: string): Promise<{ error?: string }> {
  if (!employeeId) return { error: "Missing employee." };

  const { activeOrg } = await getOrgContext();
  if (!activeOrg) return { error: "No active organization." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("employees")
    .delete()
    .eq("org_id", activeOrg.id)
    .eq("id", employeeId);
  if (error) return { error: error.message };

  revalidatePath(EMPLOYEES_PATH);
  return {};
}
