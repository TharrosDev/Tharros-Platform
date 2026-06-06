import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Day 44 — availability table RLS harness (live, provider-free).
 *
 * Member-read / owner-admin-write, like the other scheduling tables. An owner can
 * insert + replace + read an employee's availability; a plain member can read but
 * not write; an outsider sees nothing. Mirrors the Day-41 scheduling-rls harness;
 * runs in CI against the test Supabase project.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY!;

const PASSWORD = "Test-Pw-Day44-aA1!";
const RUN = Date.now().toString(36);
const emailFor = (who: string) => `avail-test-${RUN}-${who}@tharros-sched.test`;

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

let ownerId = "";
let memberId = "";
let outsiderId = "";
let orgA = "";
let employeeId = "";
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

  const { error: memErr } = await admin
    .from("memberships")
    .insert({ user_id: memberId, org_id: orgA, role: "member" });
  if (memErr) throw memErr;

  const { data: emp, error: empErr } = await admin
    .from("employees")
    .insert({ org_id: orgA, name: "Avail Tester", email: `emp-${RUN}@avail.test` })
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
  await admin.from("organizations").delete().eq("id", orgA);
  for (const id of [ownerId, memberId, outsiderId].filter(Boolean)) {
    await admin.auth.admin.deleteUser(id);
  }
});

describe("availability — member-read / manager-write", () => {
  it("an owner can insert a permanent availability row", async () => {
    const { error } = await ownerClient.from("availability").insert({
      org_id: orgA,
      employee_id: employeeId,
      kind: "permanent",
      day_of_week: 1,
      is_available: true,
      start_time: "09:00",
      end_time: "17:00",
    });
    expect(error).toBeNull();
  });

  it("an owner can add a temporary override", async () => {
    const { error } = await ownerClient.from("availability").insert({
      org_id: orgA,
      employee_id: employeeId,
      kind: "temporary",
      effective_date: "2026-06-20",
      end_date: "2026-06-25",
      is_available: false,
      notes: "Vacation",
    });
    expect(error).toBeNull();
  });

  it("a member can read the org's availability but not write it", async () => {
    const { data, error } = await memberClient
      .from("availability")
      .select("id")
      .eq("employee_id", employeeId);
    expect(error).toBeNull();
    expect((data ?? []).length).toBe(2);

    const { error: writeErr } = await memberClient.from("availability").insert({
      org_id: orgA,
      employee_id: employeeId,
      kind: "permanent",
      day_of_week: 2,
      is_available: true,
    });
    expect(writeErr).not.toBeNull();
  });

  it("the kind/day CHECK rejects a permanent row without a weekday", async () => {
    const { error } = await ownerClient.from("availability").insert({
      org_id: orgA,
      employee_id: employeeId,
      kind: "permanent",
      is_available: true,
    });
    expect(error).not.toBeNull();
  });

  it("an outsider cannot read another org's availability", async () => {
    const { data } = await outsiderClient
      .from("availability")
      .select("id")
      .eq("employee_id", employeeId);
    expect(data ?? []).toHaveLength(0);
  });
});
