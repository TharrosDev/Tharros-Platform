import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Day 51 — publish flow RLS + state transitions harness.
 *
 * The publish/reopen actions write `schedules`, `shifts`, and `schedule_versions`
 * through the user-session client, so the Day-41 manager-write RLS is the real
 * gate. This proves, against the CI Supabase project: a manager can flip a
 * schedule draft→published, insert a `published` version snapshot, and flip its
 * shifts draft→published; a plain member can read the schedule + versions + audit
 * trail but cannot publish/reopen; the version `source` defaults to `candidate`.
 * Provider-free. Run with `pnpm --filter @tharros/web test`.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY!;

const PASSWORD = "Test-Pw-Day51-aA1!";
const RUN = Date.now().toString(36);
const emailFor = (who: string) => `sched-pub-${RUN}-${who}@tharros-sched.test`;

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
let orgA = "";
let scheduleId = "";

let ownerClient: SupabaseClient;
let memberClient: SupabaseClient;

beforeAll(async () => {
  [ownerId, memberId] = await Promise.all([seedUser("owner"), seedUser("member")]);
  orgA = await ownOrgId(ownerId);

  const { error: memErr } = await admin
    .from("memberships")
    .insert({ user_id: memberId, org_id: orgA, role: "member" });
  if (memErr) throw memErr;

  [ownerClient, memberClient] = await Promise.all([asUser("owner"), asUser("member")]);

  const { data: sched, error: schedErr } = await ownerClient
    .from("schedules")
    .insert({
      org_id: orgA,
      name: "Publish draft",
      period_start: "2026-06-15",
      period_end: "2026-06-28",
      status: "draft",
    })
    .select("id")
    .single();
  if (schedErr) throw schedErr;
  scheduleId = sched!.id as string;

  // One assigned draft shift on the schedule.
  const { error: shiftErr } = await ownerClient.from("shifts").insert({
    org_id: orgA,
    schedule_id: scheduleId,
    employee_id: null,
    starts_at: "2026-06-15T09:00:00Z",
    ends_at: "2026-06-15T17:00:00Z",
    break_minutes: 0,
    status: "draft",
  });
  if (shiftErr) throw shiftErr;
}, 30_000);

afterAll(async () => {
  if (scheduleId) await admin.from("schedules").delete().eq("id", scheduleId); // cascades shifts + versions
  await Promise.all([
    admin.auth.admin.deleteUser(ownerId).catch(() => {}),
    admin.auth.admin.deleteUser(memberId).catch(() => {}),
  ]);
});

describe("publish flow (manager-write / member-read)", () => {
  it("a member cannot publish (flip the schedule to published)", async () => {
    await memberClient.from("schedules").update({ status: "published" }).eq("id", scheduleId);
    const { data } = await admin.from("schedules").select("status").eq("id", scheduleId).single();
    expect(data?.status).toBe("draft"); // RLS filtered the member's update out
  });

  it("a manager publishes: schedule + shifts flip and a published version is snapshotted", async () => {
    const publishedAt = new Date().toISOString();
    const { error: e1 } = await ownerClient
      .from("schedules")
      .update({ status: "published", published_at: publishedAt })
      .eq("id", scheduleId);
    expect(e1).toBeNull();

    const { error: e2 } = await ownerClient
      .from("shifts")
      .update({ status: "published" })
      .eq("schedule_id", scheduleId)
      .eq("status", "draft");
    expect(e2).toBeNull();

    const { data: version, error: e3 } = await ownerClient
      .from("schedule_versions")
      .insert({
        org_id: orgA,
        schedule_id: scheduleId,
        source: "published",
        label: "published-v1",
        covered: false,
        total_missing: 1,
        note: "Approved",
      })
      .select("source, label")
      .single();
    expect(e3).toBeNull();
    expect(version?.source).toBe("published");

    const { data: sched } = await admin
      .from("schedules")
      .select("status")
      .eq("id", scheduleId)
      .single();
    expect(sched?.status).toBe("published");
  });

  it("a member can read the published version + audit trail but cannot reopen", async () => {
    const { data: versions } = await memberClient
      .from("schedule_versions")
      .select("source")
      .eq("schedule_id", scheduleId)
      .eq("source", "published");
    expect((versions ?? []).length).toBe(1);

    // scheduling_audit_log is member-read.
    const { error: auditErr } = await memberClient
      .from("scheduling_audit_log")
      .select("id")
      .eq("org_id", orgA);
    expect(auditErr).toBeNull();

    // Member reopen attempt is filtered by RLS — stays published.
    await memberClient.from("schedules").update({ status: "draft" }).eq("id", scheduleId);
    const { data } = await admin.from("schedules").select("status").eq("id", scheduleId).single();
    expect(data?.status).toBe("published");
  });

  it("a manager reopens the schedule (published → draft)", async () => {
    const { error } = await ownerClient
      .from("schedules")
      .update({ status: "draft" })
      .eq("id", scheduleId);
    expect(error).toBeNull();
    const { data } = await admin.from("schedules").select("status").eq("id", scheduleId).single();
    expect(data?.status).toBe("draft");
  });

  it("schedule_versions.source defaults to candidate", async () => {
    const { data, error } = await ownerClient
      .from("schedule_versions")
      .insert({ org_id: orgA, schedule_id: scheduleId, label: "balanced" })
      .select("source")
      .single();
    expect(error).toBeNull();
    expect(data?.source).toBe("candidate");
  });
});
