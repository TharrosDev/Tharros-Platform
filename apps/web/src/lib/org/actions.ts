"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { orgDetailsSchema, type OrgFormState } from "@/lib/org/schemas";

/**
 * Org server actions. Each validates with zod, calls a SECURITY DEFINER RPC
 * (the only user-facing create/onboard paths — Day 11 withheld direct INSERT),
 * and either returns an `OrgFormState` (errors stay on the form) or redirects.
 */

function fieldErrors(error: z.ZodError) {
  return z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
}

function readDetails(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    industry: String(formData.get("industry") ?? ""),
    size: String(formData.get("size") ?? ""),
  };
}

/** Finish the first-run wizard on the auto-provisioned personal org. */
export async function completeOnboarding(
  _prev: OrgFormState,
  formData: FormData,
): Promise<OrgFormState> {
  const orgId = String(formData.get("orgId") ?? "");
  const raw = readDetails(formData);
  const parsed = orgDetailsSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error), values: raw };
  }
  if (!orgId) {
    return { message: "Missing organization. Try refreshing the page.", values: raw };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_org_onboarding", {
    p_org: orgId,
    p_name: parsed.data.name,
    p_industry: parsed.data.industry,
    p_size: parsed.data.size,
  });

  if (error) {
    return { message: error.message, values: raw };
  }

  // First-run path: send the new org straight to the subscribe surface (Day 17).
  // Day-19 gating will enforce an active/trialing subscription before the app.
  redirect("/billing");
}

/** Create an additional organization and switch to it. */
export async function createOrganization(
  _prev: OrgFormState,
  formData: FormData,
): Promise<OrgFormState> {
  const raw = readDetails(formData);
  const parsed = orgDetailsSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error), values: raw };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_organization", {
    p_name: parsed.data.name,
    p_industry: parsed.data.industry,
    p_size: parsed.data.size,
  });

  if (error) {
    return { message: error.message, values: raw };
  }

  redirect("/dashboard");
}

/** Switch the active org. Guarded server-side by the membership-check trigger. */
export async function switchOrg(orgId: string): Promise<{ error?: string }> {
  if (!orgId) return { error: "Missing organization." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { error } = await supabase
    .from("profiles")
    .update({ current_org_id: orgId })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return {};
}
