import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Day 41 — core scheduling schema RLS harness.
 *
 * Proves the org-scoped member-read / manager-write pattern holds on a
 * representative slice of the new scheduling tables, through live clients:
 *   - a service-role client seeds fixtures + asserts ground truth,
 *   - an owner client (manager) may write its org's scheduling data,
 *   - a plain member may read but not write,
 *   - an outsider (owner of another org) sees + writes nothing.
 * Mirrors the Day-37 portal-rls harness; provider-free, runs in CI against the
 * test Supabase project. Run with `pnpm --filter @tharros/web test`.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY!;

const PASSWORD = "Test-Pw-Day41-aA1!";
const RUN = Date.now().toString(36);
const emailFor = (who: string) => `sched-test-${RUN}-${who}@tharros-sched.test`;

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

let ownerId = ""; // owner of orgA
let memberId = ""; // plain member of orgA
let outsiderId = ""; // owner of orgB, no access to orgA
let orgA = "";
let scheduleId = ""; // a schedule in orgA

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

  // Seed a schedule in orgA so shift/child-row tests have a parent.
  const { data: sched, error: schedErr } = await admin
    .from("schedules")
    .insert({ org_id: orgA, name: "Week 1", period_start: "2026-06-15", period_end: "2026-06-21" })
    .select("id")
    .single();
  if (schedErr) throw schedErr;
  scheduleId = sched.id as string;

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

describe("schedules — member-read / manager-write", () => {
  it("a member can read the org's schedules", async () => {
    const { data, error } = await memberClient.from("schedules").select("id").eq("org_id", orgA);
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  it("an owner can create a schedule", async () => {
    const { error } = await ownerClient.from("schedules").insert({
      org_id: orgA,
      name: "Week 2",
      period_start: "2026-06-22",
      period_end: "2026-06-28",
    });
    expect(error).toBeNull();
  });

  it("a plain member cannot create a schedule", async () => {
    const { error } = await memberClient.from("schedules").insert({
      org_id: orgA,
      name: "Nope",
      period_start: "2026-07-01",
      period_end: "2026-07-07",
    });
    expect(error).not.toBeNull();
  });

  it("an outsider cannot read another org's schedules", async () => {
    const { data } = await outsiderClient.from("schedules").select("id").eq("org_id", orgA);
    expect(data ?? []).toHaveLength(0);
  });

  it("an outsider cannot insert into another org's schedules", async () => {
    const { error } = await outsiderClient.from("schedules").insert({
      org_id: orgA,
      name: "Intruder",
      period_start: "2026-07-01",
      period_end: "2026-07-07",
    });
    expect(error).not.toBeNull();
  });
});

describe("shifts — manager-write under a schedule", () => {
  it("an owner can add a shift to the org's schedule", async () => {
    const { error } = await ownerClient.from("shifts").insert({
      org_id: orgA,
      schedule_id: scheduleId,
      starts_at: "2026-06-15T09:00:00Z",
      ends_at: "2026-06-15T17:00:00Z",
    });
    expect(error).toBeNull();
  });

  it("a plain member cannot add a shift", async () => {
    const { error } = await memberClient.from("shifts").insert({
      org_id: orgA,
      schedule_id: scheduleId,
      starts_at: "2026-06-16T09:00:00Z",
      ends_at: "2026-06-16T17:00:00Z",
    });
    expect(error).not.toBeNull();
  });

  it("the ends_at > starts_at check rejects an inverted shift", async () => {
    const { error } = await ownerClient.from("shifts").insert({
      org_id: orgA,
      schedule_id: scheduleId,
      starts_at: "2026-06-15T17:00:00Z",
      ends_at: "2026-06-15T09:00:00Z",
    });
    expect(error).not.toBeNull(); // CHECK violation
  });
});

describe("labor_rules — one ruleset per org, manager-write", () => {
  it("an owner can upsert the org's labor rules", async () => {
    const { error } = await ownerClient
      .from("labor_rules")
      .insert({ org_id: orgA, preset: "ontario", max_weekly_hours: 48 });
    expect(error).toBeNull();
  });

  it("a member can read the org's labor rules but not write them", async () => {
    const { data, error } = await memberClient
      .from("labor_rules")
      .select("preset")
      .eq("org_id", orgA);
    expect(error).toBeNull();
    expect((data ?? []).length).toBe(1);

    // Under the manager-write UPDATE policy a member matches no rows: PostgREST
    // returns no error but updates 0 rows. The meaningful assertion is that the
    // value is unchanged.
    await memberClient.from("labor_rules").update({ max_weekly_hours: 99 }).eq("org_id", orgA);
    const { data: after } = await admin
      .from("labor_rules")
      .select("max_weekly_hours")
      .eq("org_id", orgA)
      .single();
    expect(Number(after?.max_weekly_hours)).toBe(48);
  });
});

describe("scheduling_audit_log — member-read, no client writes", () => {
  it("a member can read but cannot insert (service-role/RPC writes only)", async () => {
    // service-role seeds a row
    const { error: seedErr } = await admin.from("scheduling_audit_log").insert({
      org_id: orgA,
      actor_type: "system",
      action: "test.seed",
    });
    expect(seedErr).toBeNull();

    const { data, error } = await memberClient
      .from("scheduling_audit_log")
      .select("id")
      .eq("org_id", orgA);
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);

    const { error: writeErr } = await memberClient
      .from("scheduling_audit_log")
      .insert({ org_id: orgA, actor_type: "manager", action: "hack" });
    expect(writeErr).not.toBeNull(); // no insert policy exists
  });
});
