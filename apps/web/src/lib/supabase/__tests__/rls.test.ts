import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Day 11 — Row-Level Security isolation harness.
 *
 * Proves the tenant policies enforce cross-org isolation and the role model
 * (owners-only role changes; owners/admins add members; last owner protected).
 *
 * Strategy: the service-role client (bypasses RLS) seeds real auth users and
 * reads ground truth. Each assertion then runs through a *user-session* client
 * (publishable key) so the live policies are actually exercised — exactly the
 * path the app uses. Everything is torn down in afterAll.
 *
 * This is an integration test against the live Supabase project; it is also a
 * launch-gate item (re-run on Day 79). Run with `pnpm --filter @tharros/web test`.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY!;

const PASSWORD = "Test-Pw-Day11-aA1!";

// Unique suffix so re-runs never collide and a crash leaves identifiable rows.
const RUN = Date.now().toString(36);
const emailFor = (who: string) => `rls-test-${RUN}-${who}@tharros-rls.test`;

const admin = createClient(SUPABASE_URL, SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Create a confirmed user via the admin API; returns its id. */
async function seedUser(who: string): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email: emailFor(who),
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user.id;
}

/** A fresh user-session client signed in as the given email. */
async function asUser(email: string): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (error) throw error;
  return client;
}

/** The org auto-provisioned for a user by the Day-10 signup trigger. */
async function ownOrgId(userId: string): Promise<string> {
  const { data, error } = await admin
    .from("memberships")
    .select("org_id")
    .eq("user_id", userId)
    .eq("role", "owner")
    .single();
  if (error) throw error;
  return data.org_id as string;
}

let userA = "";
let userB = "";
let userC = "";
let orgA = "";
let orgB = "";

let clientA: SupabaseClient;
let clientB: SupabaseClient;
let clientC: SupabaseClient;

beforeAll(async () => {
  // The Day-10 trigger gives each new user a profile + personal org + owner row.
  userA = await seedUser("a");
  userB = await seedUser("b");
  userC = await seedUser("c");

  orgA = await ownOrgId(userA);
  orgB = await ownOrgId(userB);

  // Make C a plain member of org A (seeded via service role — the policy path
  // for adding members is exercised separately below).
  const { error } = await admin
    .from("memberships")
    .insert({ user_id: userC, org_id: orgA, role: "member" });
  if (error) throw error;

  clientA = await asUser(emailFor("a"));
  clientB = await asUser(emailFor("b"));
  clientC = await asUser(emailFor("c"));
});

afterAll(async () => {
  // Order matters: delete every org the seeded users belong to FIRST, then the
  // users. Deleting an auth user cascades to memberships, and if that user is
  // the last owner of a still-existing org the last-owner guard would block the
  // delete. Dropping the orgs first sidesteps the guard (it skips when the
  // parent org is already gone) and leaves the users membership-free.
  const ids = [userA, userB, userC].filter(Boolean);
  if (ids.length) {
    const { data: orgs } = await admin
      .from("memberships")
      .select("org_id")
      .in("user_id", ids);
    const orgIds = [...new Set((orgs ?? []).map((m) => m.org_id))];
    for (const id of orgIds) {
      await admin.from("organizations").delete().eq("id", id);
    }
    for (const id of ids) {
      await admin.auth.admin.deleteUser(id);
    }
  }
});

describe("cross-tenant isolation", () => {
  it("A sees only org A; B sees only org B", async () => {
    const { data: aOrgs } = await clientA.from("organizations").select("id");
    expect(aOrgs?.map((o) => o.id)).toEqual([orgA]);

    const { data: bOrgs } = await clientB.from("organizations").select("id");
    expect(bOrgs?.map((o) => o.id)).toEqual([orgB]);
  });

  it("A cannot read B's org even when naming its id", async () => {
    const { data } = await clientA
      .from("organizations")
      .select("id")
      .eq("id", orgB);
    expect(data).toEqual([]);
  });

  it("A sees org A memberships (self + C), not org B's", async () => {
    const { data } = await clientA.from("memberships").select("user_id, org_id");
    const orgIds = new Set(data?.map((m) => m.org_id));
    expect(orgIds).toEqual(new Set([orgA]));
    expect(new Set(data?.map((m) => m.user_id))).toEqual(
      new Set([userA, userC]),
    );
  });
});

describe("profiles visibility", () => {
  it("A sees own + co-member C, never B", async () => {
    const { data } = await clientA.from("profiles").select("id");
    const ids = new Set(data?.map((p) => p.id));
    expect(ids.has(userA)).toBe(true);
    expect(ids.has(userC)).toBe(true);
    expect(ids.has(userB)).toBe(false);
  });

  it("A can update own profile but not B's", async () => {
    const ok = await clientA
      .from("profiles")
      .update({ full_name: "User A" })
      .eq("id", userA)
      .select();
    expect(ok.error).toBeNull();
    expect(ok.data).toHaveLength(1);

    // RLS makes B's row invisible to the UPDATE → 0 rows affected, no error.
    const denied = await clientA
      .from("profiles")
      .update({ full_name: "hacked" })
      .eq("id", userB)
      .select();
    expect(denied.data).toEqual([]);
  });
});

describe("organization writes", () => {
  it("owner A can rename org A", async () => {
    const { data, error } = await clientA
      .from("organizations")
      .update({ name: "Renamed A" })
      .eq("id", orgA)
      .select();
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("member C cannot rename org A", async () => {
    const { data } = await clientC
      .from("organizations")
      .update({ name: "C was here" })
      .eq("id", orgA)
      .select();
    expect(data).toEqual([]);
  });

  it("an owner can delete their own org (cascade past the last-owner guard)", async () => {
    // Throwaway org owned solely by B so the main fixtures stay intact. The
    // last-owner guard must NOT block this: deleting the org cascades to its
    // memberships, and the guard skips when the parent org is already gone.
    const { data: org } = await admin
      .from("organizations")
      .insert({
        name: "B disposable",
        slug: `rls-test-${RUN}-bdel-${Math.random().toString(36).slice(2, 8)}`,
        created_by: userB,
      })
      .select()
      .single();
    await admin
      .from("memberships")
      .insert({ user_id: userB, org_id: org!.id, role: "owner" });

    const { error } = await clientB
      .from("organizations")
      .delete()
      .eq("id", org!.id);
    expect(error).toBeNull();

    const { data: gone } = await admin
      .from("organizations")
      .select("id")
      .eq("id", org!.id);
    expect(gone).toEqual([]);
  });

  it("outsider B cannot rename or delete org A", async () => {
    const upd = await clientB
      .from("organizations")
      .update({ name: "B was here" })
      .eq("id", orgA)
      .select();
    expect(upd.data).toEqual([]);

    const del = await clientB
      .from("organizations")
      .delete()
      .eq("id", orgA)
      .select();
    expect(del.data).toEqual([]);
  });
});

describe("membership writes & role model", () => {
  it("member C cannot add anyone", async () => {
    const { error } = await clientC
      .from("memberships")
      .insert({ user_id: userB, org_id: orgA, role: "member" });
    expect(error).not.toBeNull();
  });

  it("member C cannot change roles", async () => {
    const { data } = await clientC
      .from("memberships")
      .update({ role: "owner" })
      .eq("user_id", userC)
      .eq("org_id", orgA)
      .select();
    expect(data).toEqual([]);
  });

  it("owner A can promote C to admin; admin C cannot then change roles", async () => {
    const promote = await clientA
      .from("memberships")
      .update({ role: "admin" })
      .eq("user_id", userC)
      .eq("org_id", orgA)
      .select();
    expect(promote.error).toBeNull();
    expect(promote.data).toHaveLength(1);

    // C is now admin: may add a plain member, but cannot change a role.
    const roleChange = await clientC
      .from("memberships")
      .update({ role: "owner" })
      .eq("user_id", userA)
      .eq("org_id", orgA)
      .select();
    expect(roleChange.data).toEqual([]);

    // Reset C back to member for the last-owner test below.
    await clientA
      .from("memberships")
      .update({ role: "member" })
      .eq("user_id", userC)
      .eq("org_id", orgA);
  });

  it("the last owner of an org cannot be demoted or removed", async () => {
    // A is the sole owner of org A. Demotion is blocked by the guard trigger,
    // which raises a real DB exception (vs. an RLS denial that returns 0 rows).
    // No .select() here: requesting return=representation on a write that throws
    // makes supabase-js hang ~10s instead of surfacing the error promptly.
    const demote = await clientA
      .from("memberships")
      .update({ role: "member" })
      .eq("user_id", userA)
      .eq("org_id", orgA);
    expect(demote.error).not.toBeNull();

    // Removal of the last owner is likewise blocked by the guard.
    const remove = await clientA
      .from("memberships")
      .delete()
      .eq("user_id", userA)
      .eq("org_id", orgA);
    expect(remove.error).not.toBeNull();
  });

  it("a plain member can remove themselves (leave the org)", async () => {
    const { error } = await clientC
      .from("memberships")
      .delete()
      .eq("user_id", userC)
      .eq("org_id", orgA);
    expect(error).toBeNull();

    const { data } = await admin
      .from("memberships")
      .select("user_id")
      .eq("user_id", userC)
      .eq("org_id", orgA);
    expect(data).toEqual([]);
  });
});
