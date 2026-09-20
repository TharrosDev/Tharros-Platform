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
export async function deleteAccount(confirmText: string): Promise<{ error?: string }> {
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

  // Owner count per owned org → which ones the caller solely owns. One batched
  // read of every owner row across the owned orgs, tallied in JS (was an N+1:
  // one COUNT query per owned org).
  const ownerCountByOrg: Record<string, number> = {};
  if (ownedOrgIds.length > 0) {
    for (const orgId of ownedOrgIds) ownerCountByOrg[orgId] = 0;
    const { data: ownerCountRows, error: ownerCountErr } = await admin
      .from("memberships")
      .select("org_id")
      .in("org_id", ownedOrgIds)
      .eq("role", "owner");
    if (ownerCountErr) return { error: ownerCountErr.message };
    for (const row of (ownerCountRows ?? []) as { org_id: string }[]) {
      ownerCountByOrg[row.org_id] = (ownerCountByOrg[row.org_id] ?? 0) + 1;
    }
  }
  const toDelete = soleOwnedOrgIds(ownedOrgIds, ownerCountByOrg);

  // Pre-fetch the Stripe subscription for every org we're about to delete in one
  // query (was an N+1: one SELECT per org). The cancel + org delete below stay
  // per-org — Stripe is an external call and the delete is a single-row op.
  const subByOrg = new Map<
    string,
    { stripe_subscription_id: string | null; status: string | null }
  >();
  if (toDelete.length > 0) {
    const { data: subRows } = await admin
      .from("subscriptions")
      .select("org_id, stripe_subscription_id, status")
      .in("org_id", toDelete);
    for (const s of (subRows ?? []) as {
      org_id: string;
      stripe_subscription_id: string | null;
      status: string | null;
    }[]) {
      subByOrg.set(s.org_id, {
        stripe_subscription_id: s.stripe_subscription_id,
        status: s.status,
      });
    }
  }

  // Cancel each org's Stripe subscription before deleting (external call — can't
  // be inside the DB transaction; the org delete drops the mirror row).
  for (const orgId of toDelete) {
    const sub = subByOrg.get(orgId) ?? null;
    const subId = sub?.stripe_subscription_id;
    const status = sub?.status;
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
  }

  // Delete all sole-owned orgs in ONE transaction. The RPC re-verifies sole
  // ownership server-side (it never trusts the id list), so a partial failure
  // can't orphan rows the way the old per-org loop could.
  if (toDelete.length > 0) {
    const { error: delErr } = await admin.rpc("delete_owned_orgs", {
      p_user: user.id,
      p_org_ids: toDelete,
    });
    if (delErr) {
      logger.error("account.delete_orgs_failed", {
        user_id: user.id,
        org_ids: toDelete,
        error: delErr.message,
      });
      return { error: "Could not delete your organizations. Please try again." };
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
