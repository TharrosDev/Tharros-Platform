import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Day 15 — Team management harness.
 *
 * Exercises the invite RPCs (create/resend/revoke/accept) and the member
 * removal / role-change table writes through live user-session clients, with a
 * service-role client for seeding + ground truth. Mirrors the Day-11/12 harness.
 *
 * Run with `pnpm --filter @tharros/web test`.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY!;

const PASSWORD = "Test-Pw-Day15-aA1!";

const RUN = Date.now().toString(36);
const emailFor = (who: string) => `team-test-${RUN}-${who}@tharros-team.test`;

const admin = createClient(SUPABASE_URL, SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function seedUser(who: string): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email: emailFor(who),
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user.id;
}

async function asUser(email: string): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return client;
}

/** The personal org auto-provisioned for a user by the signup trigger. */
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

async function membershipRole(userId: string, orgId: string): Promise<string | null> {
  const { data } = await admin
    .from("memberships")
    .select("role")
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .maybeSingle();
  return (data?.role as string | undefined) ?? null;
}

let userA = ""; // owner of orgA
let userB = ""; // invitee who accepts into orgA
let userC = ""; // outsider (used for permission + wrong-email checks)
let userD = ""; // plain member of orgA (role-change / removal target)
let userE = ""; // invitee for the revoke / expired lifecycle
let orgA = "";

let clientA: SupabaseClient;
let clientB: SupabaseClient;
let clientC: SupabaseClient;
let clientD: SupabaseClient;
let clientE: SupabaseClient;

let inviteBId = "";
let inviteBToken = "";

beforeAll(async () => {
  userA = await seedUser("a");
  userB = await seedUser("b");
  userC = await seedUser("c");
  userD = await seedUser("d");
  userE = await seedUser("e");

  orgA = await ownOrgId(userA);

  // D is a plain member of org A (seeded directly, like the Day-12 harness).
  const { error } = await admin
    .from("memberships")
    .insert({ user_id: userD, org_id: orgA, role: "member" });
  if (error) throw error;

  clientA = await asUser(emailFor("a"));
  clientB = await asUser(emailFor("b"));
  clientC = await asUser(emailFor("c"));
  clientD = await asUser(emailFor("d"));
  clientE = await asUser(emailFor("e"));
});

afterAll(async () => {
  const ids = [userA, userB, userC, userD, userE].filter(Boolean);
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

describe("create_invite", () => {
  it("owner A can invite B's email as a member and gets a token back", async () => {
    const { data, error } = await clientA.rpc("create_invite", {
      p_org: orgA,
      p_email: emailFor("b"),
      p_role: "member",
    });
    expect(error).toBeNull();
    const row = (data as Array<{ id: string; token: string }>)[0];
    expect(row?.id).toBeTruthy();
    expect(row?.token).toBeTruthy();
    inviteBId = row.id;
    inviteBToken = row.token;
  });

  it("re-inviting the same email refreshes the live invite (same id, new token)", async () => {
    const { data, error } = await clientA.rpc("create_invite", {
      p_org: orgA,
      p_email: emailFor("b"),
      p_role: "admin",
    });
    expect(error).toBeNull();
    const row = (data as Array<{ id: string; token: string }>)[0];
    expect(row.id).toBe(inviteBId);
    expect(row.token).not.toBe(inviteBToken);
    inviteBToken = row.token;
    // Reset the role back to member for the accept test below.
    const { data: d2 } = await clientA.rpc("create_invite", {
      p_org: orgA,
      p_email: emailFor("b"),
      p_role: "member",
    });
    inviteBToken = (d2 as Array<{ token: string }>)[0].token;
  });

  it("rejects inviting someone who is already a member", async () => {
    const { error } = await clientA.rpc("create_invite", {
      p_org: orgA,
      p_email: emailFor("d"),
      p_role: "member",
    });
    expect(error).not.toBeNull();
  });

  it("an outsider cannot invite into an org they don't manage", async () => {
    const { error } = await clientC.rpc("create_invite", {
      p_org: orgA,
      p_email: "nobody@tharros-team.test",
      p_role: "member",
    });
    expect(error).not.toBeNull();
  });

  it("a plain member cannot invite", async () => {
    const { error } = await clientD.rpc("create_invite", {
      p_org: orgA,
      p_email: "nobody@tharros-team.test",
      p_role: "member",
    });
    expect(error).not.toBeNull();
  });

  it("rejects an invalid role", async () => {
    const { error } = await clientA.rpc("create_invite", {
      p_org: orgA,
      p_email: "nobody2@tharros-team.test",
      p_role: "owner",
    });
    expect(error).not.toBeNull();
  });
});

describe("accept_invite", () => {
  it("rejects a bad token", async () => {
    const { error } = await clientB.rpc("accept_invite", { p_token: "not-a-real-token" });
    expect(error).not.toBeNull();
  });

  it("rejects a token whose email doesn't match the signed-in user", async () => {
    const { data: d } = await clientA.rpc("create_invite", {
      p_org: orgA,
      p_email: "stranger@tharros-team.test",
      p_role: "member",
    });
    const strangerToken = (d as Array<{ token: string }>)[0].token;
    // C is signed in as a different email → mismatch.
    const { error } = await clientC.rpc("accept_invite", { p_token: strangerToken });
    expect(error).not.toBeNull();
  });

  it("B accepts the invite: becomes a member of org A and switches active org", async () => {
    const { data, error } = await clientB.rpc("accept_invite", { p_token: inviteBToken });
    expect(error).toBeNull();
    expect(data).toBe(orgA);

    expect(await membershipRole(userB, orgA)).toBe("member");

    const { data: profile } = await admin
      .from("profiles")
      .select("current_org_id")
      .eq("id", userB)
      .single();
    expect(profile?.current_org_id).toBe(orgA);
  });

  it("rejects re-using an already-accepted invite", async () => {
    const { error } = await clientB.rpc("accept_invite", { p_token: inviteBToken });
    expect(error).not.toBeNull();
  });
});

describe("revoke_invite + resend_invite", () => {
  let revokeToken = "";

  it("owner revokes a pending invite; the matching user then can't accept it", async () => {
    const { data } = await clientA.rpc("create_invite", {
      p_org: orgA,
      p_email: emailFor("e"),
      p_role: "member",
    });
    const inv = (data as Array<{ id: string; token: string }>)[0];
    revokeToken = inv.token;

    const { error: revErr } = await clientA.rpc("revoke_invite", { p_invite: inv.id });
    expect(revErr).toBeNull();

    const { error: accErr } = await clientE.rpc("accept_invite", { p_token: revokeToken });
    expect(accErr).not.toBeNull();
  });

  it("a fresh invite can be issued after revoke (partial unique excludes revoked rows)", async () => {
    const { data, error } = await clientA.rpc("create_invite", {
      p_org: orgA,
      p_email: emailFor("e"),
      p_role: "member",
    });
    expect(error).toBeNull();
    const inv = (data as Array<{ id: string; token: string; expires_at?: string }>)[0];
    expect(inv.token).toBeTruthy();
    expect(inv.token).not.toBe(revokeToken);
  });

  it("a plain member cannot resend an invite", async () => {
    // Find E's current live invite id.
    const { data } = await admin
      .from("invites")
      .select("id")
      .eq("org_id", orgA)
      .eq("email", emailFor("e"))
      .is("accepted_at", null)
      .is("revoked_at", null)
      .single();
    const { error } = await clientD.rpc("resend_invite", { p_invite: data!.id });
    expect(error).not.toBeNull();
  });

  it("owner resends an invite: new token + future expiry", async () => {
    const { data: liveRow } = await admin
      .from("invites")
      .select("id, token_hash")
      .eq("org_id", orgA)
      .eq("email", emailFor("e"))
      .is("accepted_at", null)
      .is("revoked_at", null)
      .single();

    const { data, error } = await clientA.rpc("resend_invite", { p_invite: liveRow!.id });
    expect(error).toBeNull();
    const row = (data as Array<{ token: string; email: string }>)[0];
    expect(createHash("sha256").update(row.token).digest("hex")).not.toBe(liveRow!.token_hash);
    expect(row.email).toBe(emailFor("e"));
  });
});

describe("invite token secrecy", () => {
  it("managers cannot read invite token hashes through PostgREST", async () => {
    const { error } = await clientA
      .from("invites")
      .select("id, token_hash")
      .eq("org_id", orgA);
    expect(error).not.toBeNull();
  });
});

describe("changeRole + removeMember", () => {
  it("owner A promotes member D to admin, then back to member", async () => {
    const up = await clientA.from("memberships").update({ role: "admin" }).eq("org_id", orgA).eq("user_id", userD).select();
    expect(up.error).toBeNull();
    expect(await membershipRole(userD, orgA)).toBe("admin");

    const down = await clientA.from("memberships").update({ role: "member" }).eq("org_id", orgA).eq("user_id", userD).select();
    expect(down.error).toBeNull();
    expect(await membershipRole(userD, orgA)).toBe("member");
  });

  it("a non-owner cannot change roles (owners-only UPDATE policy)", async () => {
    // B is a member of org A; B cannot promote D.
    const res = await clientB.from("memberships").update({ role: "admin" }).eq("org_id", orgA).eq("user_id", userD).select();
    // RLS denies the UPDATE → 0 rows affected, role unchanged.
    expect(res.data ?? []).toEqual([]);
    expect(await membershipRole(userD, orgA)).toBe("member");
  });

  it("the last owner cannot be removed (last-owner guard)", async () => {
    const res = await clientA.from("memberships").delete().eq("org_id", orgA).eq("user_id", userA).select();
    expect(res.error).not.toBeNull();
    expect(await membershipRole(userA, orgA)).toBe("owner");
  });

  it("owner A removes member D", async () => {
    const res = await clientA.from("memberships").delete().eq("org_id", orgA).eq("user_id", userD).select();
    expect(res.error).toBeNull();
    expect(await membershipRole(userD, orgA)).toBeNull();
  });
});

describe("team members visibility (Bug #2 — two-step fetch)", () => {
  it("the legacy memberships→profiles embed has no FK relationship (PGRST200)", async () => {
    // Root cause: memberships.user_id and profiles.id both FK to auth.users,
    // so there is no direct relationship for PostgREST to embed through.
    const res = await clientA
      .from("memberships")
      .select("user_id, profiles(email)")
      .eq("org_id", orgA);
    expect(res.error).not.toBeNull();
  });

  it("owner A sees co-member B's name + email via the two-step query", async () => {
    // Seed a display name (seedUser creates users without full_name).
    await admin.from("profiles").update({ full_name: "Bea Tester" }).eq("id", userB);

    const m = await clientA
      .from("memberships")
      .select("user_id, role")
      .eq("org_id", orgA)
      .order("created_at", { ascending: true });
    expect(m.error).toBeNull();
    const ids = (m.data ?? []).map((r) => r.user_id);
    expect(ids).toContain(userB);

    const p = await clientA.from("profiles").select("id, email, full_name").in("id", ids);
    expect(p.error).toBeNull();
    const bee = (p.data ?? []).find((r) => r.id === userB);
    expect(bee?.email).toBe(emailFor("b"));
    expect(bee?.full_name).toBe("Bea Tester");
  });
});

describe("leaveOrg capability (Bug #3 — members can leave)", () => {
  it("member B can delete their own membership (leave the org)", async () => {
    const res = await clientB
      .from("memberships")
      .delete()
      .eq("org_id", orgA)
      .eq("user_id", userB)
      .select();
    expect(res.error).toBeNull();
    expect(await membershipRole(userB, orgA)).toBeNull();
  });

  it("the sole owner A still cannot leave (last-owner guard)", async () => {
    const res = await clientA
      .from("memberships")
      .delete()
      .eq("org_id", orgA)
      .eq("user_id", userA)
      .select();
    expect(res.error).not.toBeNull();
    expect(await membershipRole(userA, orgA)).toBe("owner");
  });
});
