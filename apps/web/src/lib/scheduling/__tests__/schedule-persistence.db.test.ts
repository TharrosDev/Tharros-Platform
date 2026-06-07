import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Day 49 — schedule persistence + schedule_versions RLS harness.
 *
 * Proves the candidate panel's persistence contract against the CI Supabase
 * project: a manager can write a draft schedule (with optimization_summary), its
 * shifts, and the candidate schedule_versions; a plain member may read versions but
 * not write them; an outsider sees nothing. Mirrors the Day-41 scheduling-rls
 * harness. Provider-free. Run with `pnpm --filter @tharros/web test`.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY!;

const PASSWORD = "Test-Pw-Day49-aA1!";
const RUN = Date.now().toString(36);
const emailFor = (who: string) => `sched-ver-${RUN}-${who}@tharros-sched.test`;

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
  const { error } = await client.auth.signInWithPassword({ email: emailFor(who), password: PASSWORD });
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
let scheduleId = "";

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

  [ownerClient, memberClient, outsiderClient] = await Promise.all([
    asUser("owner"),
    asUser("member"),
    asUser("outsider"),
  ]);
}, 30_000);

afterAll(async () => {
  if (scheduleId) await admin.from("schedules").delete().eq("id", scheduleId); // cascades shifts + versions
  await Promise.all([
    admin.auth.admin.deleteUser(ownerId).catch(() => {}),
    admin.auth.admin.deleteUser(memberId).catch(() => {}),
    admin.auth.admin.deleteUser(outsiderId).catch(() => {}),
  ]);
});

describe("schedule + versions persistence (manager-write / member-read)", () => {
  it("a manager writes a draft schedule with optimization_summary", async () => {
    const { data, error } = await ownerClient
      .from("schedules")
      .insert({
        org_id: orgA,
        name: "Panel draft",
        period_start: "2026-06-15",
        period_end: "2026-06-21",
        status: "draft",
        optimization_summary: "Fairness candidate won: best coverage, evenest hours.",
      })
      .select("id, optimization_summary")
      .single();
    expect(error).toBeNull();
    expect(data?.optimization_summary).toContain("Fairness candidate");
    scheduleId = data!.id as string;
  });

  it("a manager writes shifts (including an open shift) onto the schedule", async () => {
    const { error } = await ownerClient.from("shifts").insert({
      org_id: orgA,
      schedule_id: scheduleId,
      employee_id: null, // open shift
      starts_at: "2026-06-15T09:00:00Z",
      ends_at: "2026-06-15T17:00:00Z",
      break_minutes: 0,
      status: "open",
    });
    expect(error).toBeNull();
  });

  it("a manager writes candidate schedule_versions", async () => {
    const { error } = await ownerClient.from("schedule_versions").insert([
      { org_id: orgA, schedule_id: scheduleId, label: "balanced", covered: true, total_missing: 0, judge_rank: 2, is_selected: false },
      { org_id: orgA, schedule_id: scheduleId, label: "fairness", covered: true, total_missing: 0, judge_rank: 1, is_selected: true },
    ]);
    expect(error).toBeNull();

    const { data } = await ownerClient
      .from("schedule_versions")
      .select("label, is_selected")
      .eq("schedule_id", scheduleId);
    expect((data ?? []).length).toBe(2);
    expect((data ?? []).find((v) => v.is_selected)?.label).toBe("fairness");
  });

  it("a plain member can read versions but cannot write them", async () => {
    const { data } = await memberClient
      .from("schedule_versions")
      .select("id")
      .eq("schedule_id", scheduleId);
    expect((data ?? []).length).toBe(2);

    const { error } = await memberClient
      .from("schedule_versions")
      .insert({ org_id: orgA, schedule_id: scheduleId, label: "cost" })
      .select("id")
      .single();
    expect(error).not.toBeNull();
  });

  it("an outsider sees no versions", async () => {
    const { data } = await outsiderClient
      .from("schedule_versions")
      .select("id")
      .eq("schedule_id", scheduleId);
    expect(data ?? []).toHaveLength(0);
  });
});
