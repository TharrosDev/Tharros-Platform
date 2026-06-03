import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Day 37 — employee portal foundation harness.
 *
 * Exercises the two new SECURITY DEFINER RPCs (`issue_portal_token`,
 * `validate_portal_token`) and the `employees` RLS through live clients:
 *   - a service-role client seeds fixtures + asserts ground truth,
 *   - user-session clients prove the manager-only gating on issue,
 *   - an anon client (no session) proves the portal door works without an account.
 * Mirrors the Day-11/15/27 harnesses; provider-free, runs in CI against the test
 * Supabase project. Run with `pnpm --filter @tharros/web test`.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY!;

const PASSWORD = "Test-Pw-Day37-aA1!";
const RUN = Date.now().toString(36);
const emailFor = (who: string) => `portal-test-${RUN}-${who}@tharros-portal.test`;

const admin = createClient(SUPABASE_URL, SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Anon client (no session) — exercises the anon-granted validate RPC. */
const anon = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
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

async function asUser(who: string): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email: emailFor(who),
    password: PASSWORD,
  });
  if (error) throw error;
  return client;
}

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

let ownerId = ""; // owner of orgA
let memberId = ""; // plain member of orgA
let outsiderId = ""; // owner of orgB, no access to orgA
let orgA = "";
let employeeId = ""; // an employee in orgA

let ownerClient: SupabaseClient;
let memberClient: SupabaseClient;
let outsiderClient: SupabaseClient;

beforeAll(async () => {
  [ownerId, memberId, outsiderId] = await Promise.all([
    seedUser("owner"),
    seedUser("member"),
    seedUser("outsider"),
  ]);
  orgA = await ownOrgId(ownerId);

  // Add the member to orgA (service role bypasses RLS for seeding).
  const { error: memErr } = await admin
    .from("memberships")
    .insert({ user_id: memberId, org_id: orgA, role: "member" });
  if (memErr) throw memErr;

  // Seed an employee in orgA.
  const { data: emp, error: empErr } = await admin
    .from("employees")
    .insert({ org_id: orgA, name: "Sam Rivera", email: "sam@orga.test" })
    .select("id")
    .single();
  if (empErr) throw empErr;
  employeeId = emp.id as string;

  [ownerClient, memberClient, outsiderClient] = await Promise.all([
    asUser("owner"),
    asUser("member"),
    asUser("outsider"),
  ]);
});

afterAll(async () => {
  // Delete orgA (cascade clears employees + tokens + memberships), then users.
  await admin.from("organizations").delete().eq("id", orgA);
  for (const id of [ownerId, memberId, outsiderId].filter(Boolean)) {
    await admin.auth.admin.deleteUser(id);
  }
});

async function issueToken(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.rpc("issue_portal_token", {
    p_employee_id: employeeId,
  });
  if (error) throw error;
  return data as string;
}

async function validate(token: string) {
  const { data, error } = await anon.rpc("validate_portal_token", { p_token: token });
  if (error) throw error;
  return (data ?? []) as Array<{
    employee_id: string;
    org_id: string;
    employee_name: string;
    org_name: string;
  }>;
}

describe("issue_portal_token — manager gating", () => {
  it("an owner can issue a token", async () => {
    const token = await issueToken(ownerClient);
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(32);
  });

  it("a plain member cannot issue a token", async () => {
    await expect(issueToken(memberClient)).rejects.toThrow();
  });

  it("an outsider cannot issue a token", async () => {
    await expect(issueToken(outsiderClient)).rejects.toThrow();
  });
});

describe("validate_portal_token — the portal door (anon)", () => {
  it("returns the scoped employee identity for a live token", async () => {
    const token = await issueToken(ownerClient);
    const rows = await validate(token);
    expect(rows).toHaveLength(1);
    expect(rows[0].employee_id).toBe(employeeId);
    expect(rows[0].org_id).toBe(orgA);
    expect(rows[0].employee_name).toBe("Sam Rivera");
    expect(rows[0].org_name).toBeTruthy();
  });

  it("returns nothing for an unknown token", async () => {
    expect(await validate("not-a-real-token")).toHaveLength(0);
  });

  it("rotation revokes the prior token", async () => {
    const first = await issueToken(ownerClient);
    const second = await issueToken(ownerClient);
    expect(first).not.toBe(second);
    expect(await validate(first)).toHaveLength(0); // revoked by rotation
    expect(await validate(second)).toHaveLength(1); // the live one
  });

  it("returns nothing for an expired token", async () => {
    const token = await issueToken(ownerClient);
    await admin
      .from("employee_portal_tokens")
      .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
      .eq("token", token);
    expect(await validate(token)).toHaveLength(0);
  });

  it("returns nothing when the employee is inactive", async () => {
    const token = await issueToken(ownerClient);
    await admin.from("employees").update({ active: false }).eq("id", employeeId);
    expect(await validate(token)).toHaveLength(0);
    await admin.from("employees").update({ active: true }).eq("id", employeeId); // restore
  });
});

describe("employees — RLS isolation", () => {
  it("a member of the org can read its roster", async () => {
    const { data, error } = await memberClient
      .from("employees")
      .select("id")
      .eq("org_id", orgA);
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  it("an outsider cannot read another org's roster", async () => {
    const { data } = await outsiderClient.from("employees").select("id").eq("org_id", orgA);
    expect(data ?? []).toHaveLength(0);
  });

  it("an outsider cannot insert into another org's roster", async () => {
    const { error } = await outsiderClient
      .from("employees")
      .insert({ org_id: orgA, name: "Intruder", email: "x@y.test" });
    expect(error).not.toBeNull(); // RLS with-check denies it
  });

  it("a plain member cannot add an employee (owner/admin only)", async () => {
    const { error } = await memberClient
      .from("employees")
      .insert({ org_id: orgA, name: "Nope", email: "n@y.test" });
    expect(error).not.toBeNull();
  });

  it("an owner can add an employee", async () => {
    const { error } = await ownerClient
      .from("employees")
      .insert({ org_id: orgA, name: "Pat Lee", email: "pat@orga.test" });
    expect(error).toBeNull();
  });
});
