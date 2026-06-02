"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/current-user";
import { getOrgContext } from "@/lib/org/queries";
import { getStripe } from "@/lib/billing/client";
import { logger } from "@/lib/observability/logger";
import {
  notificationsSchema,
  orgDetailsSchema,
  type OrgFormState,
} from "@/lib/org/schemas";

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

/**
 * Repoint the caller's active org to any remaining membership (or null) after
 * the current active org goes away. Mirrors the leaveOrg repoint so
 * profiles.current_org_id never dangles. Operates on the caller's own rows.
 */
async function repointActiveOrg(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const { data: remaining } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1);
  const nextOrgId = (remaining?.[0] as { org_id: string } | undefined)?.org_id ?? null;
  await supabase.from("profiles").update({ current_org_id: nextOrgId }).eq("id", userId);
}

/** Update the active org's business identity (name/industry/size). Owner-only. */
export async function updateOrganization(
  _prev: OrgFormState,
  formData: FormData,
): Promise<OrgFormState> {
  const raw = readDetails(formData);
  const parsed = orgDetailsSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error), values: raw };
  }

  const { activeOrg } = await getOrgContext();
  if (!activeOrg) {
    return { message: "No active organization. Try refreshing the page.", values: raw };
  }
  if (activeOrg.role !== "owner") {
    return { message: "Only the organization owner can edit these details.", values: raw };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({
      name: parsed.data.name,
      industry: parsed.data.industry,
      size: parsed.data.size,
    })
    .eq("id", activeOrg.id);

  if (error) {
    return { message: error.message, values: raw };
  }

  revalidatePath("/", "layout");
  return { ok: true, message: "Business profile updated." };
}

/** Update the active org's notification preferences. Owner/admin only. */
export async function updateNotifications(
  _prev: OrgFormState,
  formData: FormData,
): Promise<OrgFormState> {
  const { activeOrg } = await getOrgContext();
  if (!activeOrg) {
    return { message: "No active organization. Try refreshing the page." };
  }
  if (activeOrg.role !== "owner" && activeOrg.role !== "admin") {
    return { message: "Only owners and admins can change notification settings." };
  }

  // Unchecked switches don't appear in FormData, so derive each flag from
  // presence. The schema keys are the source of truth for which flags exist.
  const raw: Record<string, boolean> = {};
  for (const key of Object.keys(notificationsSchema.shape)) {
    raw[key] = formData.get(key) === "on";
  }
  const parsed = notificationsSchema.safeParse(raw);
  if (!parsed.success) {
    return { message: "Could not save your preferences. Please try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("org_settings")
    .update({ notifications: parsed.data })
    .eq("org_id", activeOrg.id);

  if (error) {
    return { message: error.message };
  }

  revalidatePath("/settings/notifications");
  return { ok: true, message: "Notification preferences saved." };
}

/**
 * Delete the active organization (danger zone). Owner-only. Cancels the Stripe
 * subscription first (if any) so we don't leave a billing relationship behind,
 * then deletes the org row — the Day-11 owner DELETE policy permits it and the
 * cascade removes memberships, org_settings, and the subscriptions row. The
 * last-owner guard intentionally skips when the org itself is going away.
 * Finally repoints the caller's active org so the switcher doesn't dangle.
 */
export async function deleteOrganization(
  confirmName: string,
): Promise<{ error?: string }> {
  const [user, { activeOrg }] = await Promise.all([getAuthUser(), getOrgContext()]);
  if (!user || !activeOrg) return { error: "No active organization." };
  if (activeOrg.role !== "owner") {
    return { error: "Only the organization owner can delete it." };
  }
  if (confirmName.trim() !== activeOrg.name) {
    return { error: "The name you typed doesn't match. Deletion cancelled." };
  }

  const supabase = await createClient();

  // Cancel the Stripe subscription before the cascade drops our local mirror.
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("stripe_subscription_id, status")
    .eq("org_id", activeOrg.id)
    .maybeSingle();
  const subId = (sub as { stripe_subscription_id: string | null } | null)
    ?.stripe_subscription_id;
  const status = (sub as { status: string | null } | null)?.status;
  if (subId && status && status !== "canceled" && status !== "incomplete_expired") {
    try {
      await getStripe().subscriptions.cancel(subId);
    } catch (err) {
      logger.error("org.delete_cancel_subscription_failed", {
        org_id: activeOrg.id,
        subscription_id: subId,
        error: err instanceof Error ? err.message : String(err),
      });
      return {
        error: "Could not cancel the active subscription. Please try again.",
      };
    }
  }

  const { error } = await supabase
    .from("organizations")
    .delete()
    .eq("id", activeOrg.id);
  if (error) return { error: error.message };

  await repointActiveOrg(supabase, user.id);

  revalidatePath("/", "layout");
  return {};
}
