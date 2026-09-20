import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Day 50 — schedule-calendar shift edits RLS harness.
 *
 * The calendar's manual edits (assign / retime / add / delete / lock) all write
 * `shifts` through the user-session client, so the Day-41 manager-write RLS is the
 * real gate. This proves that contract against the CI Supabase project plus the
 * new `locked` column: a manager can add, lock, retime, and delete a shift; a
 * plain member can read but none of those writes take effect; `locked` round-trips
 * and defaults to false. Provider-free. Run with `pnpm --filter @tharros/web test`.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY!;

const PASSWORD = "Test-Pw-Day50-aA1!";
const RUN = Date.now().toString(36);
const emailFor = (who: string) => `sched-cal-${RUN}-${who}@tharros-sched.test`;

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
let shiftId = "";

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
      name: "Calendar draft",
      period_start: "2026-06-15",
      period_end: "2026-06-28",
      status: "draft",
    })
    .select("id")
    .single();
  if (schedErr) throw schedErr;
  scheduleId = sched!.id as string;
}, 30_000);

afterAll(async () => {
  if (scheduleId) await admin.from("schedules").delete().eq("id", scheduleId); // cascades shifts
  await Promise.all([
    admin.auth.admin.deleteUser(ownerId).catch(() => {}),
    admin.auth.admin.deleteUser(memberId).catch(() => {}),
  ]);
});

describe("schedule-calendar shift edits (manager-write / member-read)", () => {
  it("a manager adds an open shift; locked defaults to false", async () => {
    const { data, error } = await ownerClient
      .from("shifts")
      .insert({
        org_id: orgA,
        schedule_id: scheduleId,
        employee_id: null,
        starts_at: "2026-06-15T09:00:00Z",
        ends_at: "2026-06-15T17:00:00Z",
        break_minutes: 0,
        status: "open",
      })
      .select("id, locked")
      .single();
    expect(error).toBeNull();
    expect(data?.locked).toBe(false);
    shiftId = data!.id as string;
  });

  it("a manager retimes the shift", async () => {
    const { error } = await ownerClient
      .from("shifts")
      .update({ starts_at: "2026-06-15T10:00:00Z", ends_at: "2026-06-15T18:00:00Z" })
      .eq("id", shiftId);
    expect(error).toBeNull();

    const { data } = await admin.from("shifts").select("starts_at").eq("id", shiftId).single();
    expect((data?.starts_at as string).startsWith("2026-06-15T10:00")).toBe(true);
  });

  it("a manager locks the shift and the flag round-trips", async () => {
    const { error } = await ownerClient.from("shifts").update({ locked: true }).eq("id", shiftId);
    expect(error).toBeNull();

    const { data } = await ownerClient.from("shifts").select("locked").eq("id", shiftId).single();
    expect(data?.locked).toBe(true);
  });

  it("a plain member can read the shift but cannot lock/unlock it", async () => {
    const { data: readable } = await memberClient
      .from("shifts")
      .select("id, locked")
      .eq("id", shiftId);
    expect((readable ?? []).length).toBe(1);

    // RLS filters the row out of the member's UPDATE — no rows change, value unchanged.
    await memberClient.from("shifts").update({ locked: false }).eq("id", shiftId);
    const { data } = await admin.from("shifts").select("locked").eq("id", shiftId).single();
    expect(data?.locked).toBe(true);
  });

  it("a plain member cannot add a shift", async () => {
    const { error } = await memberClient
      .from("shifts")
      .insert({
        org_id: orgA,
        schedule_id: scheduleId,
        employee_id: null,
        starts_at: "2026-06-16T09:00:00Z",
        ends_at: "2026-06-16T17:00:00Z",
        break_minutes: 0,
        status: "open",
      })
      .select("id")
      .single();
    expect(error).not.toBeNull();
  });

  it("a plain member cannot delete a shift", async () => {
    await memberClient.from("shifts").delete().eq("id", shiftId);
    const { data } = await admin.from("shifts").select("id").eq("id", shiftId);
    expect((data ?? []).length).toBe(1); // still there
  });

  it("a manager deletes the shift", async () => {
    const { error } = await ownerClient.from("shifts").delete().eq("id", shiftId);
    expect(error).toBeNull();
    const { data } = await admin.from("shifts").select("id").eq("id", shiftId);
    expect(data ?? []).toHaveLength(0);
  });
});
