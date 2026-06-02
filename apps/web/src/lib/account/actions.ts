"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/auth/current-user";
import { getStripe } from "@/lib/billing/client";
import { logger } from "@/lib/observability/logger";
import { soleOwnedOrgIds } from "@/lib/account/owned-orgs";

/**
 * Day 21 — full account deletion (PIPEDA right-to-erasure). The danger zone's
 * heaviest action: removes the auth user and everything that hangs off them.
 *
 * Order matters:
 *   1. Re-verify the caller from their own session (never trust client input).
 *   2. Find the orgs they OWN; the ones they solely own can't survive them, so
 *      cancel each org's Stripe subscription and delete the org (cascade clears
 *      memberships/org_settings/subscriptions). Co-owned orgs are left intact —
 *      the user's membership cascades on the auth-row delete.
 *   3. Sign out (clears this browser's session cookies).
 *   4. Delete the auth user via the service-role admin client. That cascades to
 *      profiles + memberships; organizations.created_by is now ON DELETE SET
 *      NULL (Day-21 migration) so any surviving orgs don't block the delete.
 *   5. Redirect to the marketing home.
 *
 * The admin client bypasses RLS, so every org id it touches is derived from the
 * verified caller's own ownership rows — not from any client-supplied value.
 */
export async function deleteAccount(
  confirmText: string,
): Promise<{ error?: string }> {
  if (confirmText.trim().toUpperCase() !== "DELETE") {
    return { error: 'Type "DELETE" to confirm. Deletion cancelled.' };
  }

  const user = await getAuthUser();
  if (!user) return { error: "You must be signed in." };

  const admin = createAdminClient();

  // Orgs this user owns.
  const { data: ownerRows, error: ownerErr } = await admin
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("role", "owner");
  if (ownerErr) return { error: ownerErr.message };

  const ownedOrgIds = (ownerRows ?? []).map((r) => (r as { org_id: string }).org_id);

  // Owner count per owned org → which ones the caller solely owns.
  const ownerCountByOrg: Record<string, number> = {};
  for (const orgId of ownedOrgIds) {
    const { count } = await admin
      .from("memberships")
      .select("user_id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("role", "owner");
    ownerCountByOrg[orgId] = count ?? 0;
  }
  const toDelete = soleOwnedOrgIds(ownedOrgIds, ownerCountByOrg);

  for (const orgId of toDelete) {
    // Cancel the org's Stripe subscription before the cascade drops the mirror.
    const { data: sub } = await admin
      .from("subscriptions")
      .select("stripe_subscription_id, status")
      .eq("org_id", orgId)
      .maybeSingle();
    const subId = (sub as { stripe_subscription_id: string | null } | null)
      ?.stripe_subscription_id;
    const status = (sub as { status: string | null } | null)?.status;
    if (subId && status && status !== "canceled" && status !== "incomplete_expired") {
      try {
        await getStripe().subscriptions.cancel(subId);
      } catch (err) {
        logger.error("account.delete_cancel_subscription_failed", {
          user_id: user.id,
          org_id: orgId,
          subscription_id: subId,
          error: err instanceof Error ? err.message : String(err),
        });
        return { error: "Could not cancel an active subscription. Please try again." };
      }
    }

    const { error: delErr } = await admin.from("organizations").delete().eq("id", orgId);
    if (delErr) {
      logger.error("account.delete_org_failed", {
        user_id: user.id,
        org_id: orgId,
        error: delErr.message,
      });
      return { error: "Could not delete one of your organizations. Please try again." };
    }
  }

  // Clear this browser's session, then remove the auth user (cascades the rest).
  const supabase = await createClient();
  await supabase.auth.signOut();

  const { error: userErr } = await admin.auth.admin.deleteUser(user.id);
  if (userErr) {
    logger.error("account.delete_user_failed", {
      user_id: user.id,
      error: userErr.message,
    });
    return { error: "Could not delete your account. Please contact support." };
  }

  redirect("/");
}
