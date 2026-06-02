import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Day 22 — E2E service-role helpers.
 *
 * Mirrors the Vitest harness convention in lib/<domain>/__tests__: a service-role
 * client that bypasses RLS to seed fixtures and read ground truth against the
 * dedicated TEST Supabase project (never prod). Kept out of app code — the app
 * never imports `e2e/`.
 *
 * The subscription helper writes `public.subscriptions` directly (service role).
 * In production that table's only writer is the Day-18 webhook; here we seed the
 * same shape it would persist, which is all the Day-19 gate reads — giving the
 * spine a deterministic gated→active→canceled transition without driving the
 * flaky Stripe Checkout iframe.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY!;

/** Shared password for every seeded/signed-up E2E user. */
export const E2E_PASSWORD = "Test-Pw-Day22-aA1!";

export const admin: SupabaseClient = createClient(SUPABASE_URL, SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** A unique, identifiable email per run so a crash leaves traceable rows. */
export function emailFor(run: string, who: string): string {
  return `e2e-${run}-${who}@tharros-e2e.test`;
}

/** Create an already email-confirmed user (for the invitee / secondary actors). */
export async function createConfirmedUser(email: string): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: E2E_PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user.id;
}

/**
 * Confirm a user who just signed up through the UI (signup keeps email
 * verification required in prod; the spine bypasses the email click here). The
 * Day-10 trigger writes a profiles row with the email, so we resolve the id from
 * there, then flip email_confirm via the admin API.
 */
export async function confirmUserByEmail(email: string): Promise<string> {
  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .single();
  if (error) throw error;
  const id = (data as { id: string }).id;
  const { error: updErr } = await admin.auth.admin.updateUserById(id, {
    email_confirm: true,
  });
  if (updErr) throw updErr;
  return id;
}

/** The personal org auto-provisioned for a user by the Day-10 signup trigger. */
export async function ownOrgId(userId: string): Promise<string> {
  const { data, error } = await admin
    .from("memberships")
    .select("org_id")
    .eq("user_id", userId)
    .eq("role", "owner")
    .single();
  if (error) throw error;
  return (data as { org_id: string }).org_id;
}

/** The live (unaccepted, unrevoked) invite token for an (org, email). */
export async function inviteTokenFor(orgId: string, email: string): Promise<string> {
  const { data, error } = await admin
    .from("invites")
    .select("token")
    .eq("org_id", orgId)
    .eq("email", email.toLowerCase())
    .is("accepted_at", null)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (error) throw error;
  return (data as { token: string }).token;
}

/** Whether a user is currently a member of an org (proves an invite was accepted). */
export async function isMember(orgId: string, userId: string): Promise<boolean> {
  const { count } = await admin
    .from("memberships")
    .select("user_id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("user_id", userId);
  return (count ?? 0) > 0;
}

export type SeedStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "paused";

/**
 * Seed/overwrite the org's subscription row to a given status — the same shape
 * the Day-18 webhook persists. Used to flip the Day-19 gate deterministically.
 */
export async function setSubscription(
  orgId: string,
  status: SeedStatus,
  tier: "starter" | "growth" | "pro" = "growth",
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const { error } = await admin.from("subscriptions").upsert(
    {
      org_id: orgId,
      stripe_subscription_id: `sub_e2e_${orgId}`,
      stripe_customer_id: `cus_e2e_${orgId}`,
      status,
      tier,
      price_id: "price_e2e",
      current_period_end: new Date((now + 30 * 86_400) * 1000).toISOString(),
      cancel_at_period_end: false,
      trial_ends_at: null,
    },
    { onConflict: "org_id" },
  );
  if (error) throw error;
}

/**
 * Tear down seeded users: delete their orgs first (cascade clears memberships /
 * org_settings / subscriptions / invites; cascade also skips the last-owner
 * guard), then the auth users. Mirrors the Vitest harness afterAll.
 */
export async function cleanup(userIds: string[]): Promise<void> {
  const ids = userIds.filter(Boolean);
  if (!ids.length) return;

  const { data: orgs } = await admin
    .from("memberships")
    .select("org_id")
    .in("user_id", ids);
  const orgIds = [...new Set((orgs ?? []).map((m) => (m as { org_id: string }).org_id))];
  for (const id of orgIds) {
    await admin.from("organizations").delete().eq("id", id);
  }
  for (const id of ids) {
    await admin.auth.admin.deleteUser(id);
  }
}
