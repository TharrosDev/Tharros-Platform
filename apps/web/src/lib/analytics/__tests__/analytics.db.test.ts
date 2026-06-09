import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Day 59 — scheduling-analytics RPC harness. Seeds a known org (2 assigned + 1
 * open published shift, a sick-call, 2 replacement offers of which 1 accepted, a
 * swap, a time-off request) and asserts both SECURITY DEFINER RPCs aggregate it
 * correctly through a real member session — plus the membership guard (a
 * non-member gets a single zero overview row and no per-employee rows). Mirrors
 * the agent-threads-rls harness: service-role seeds, assertions run as the user.
 *
 * Run with `pnpm --filter @tharros/web test`.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY!;

const PASSWORD = "Test-Pw-Day59-aA1!";
const RUN = Date.now().toString(36);
const emailFor = (who: string) => `analytics-${RUN}-${who}@tharros-rls.test`;

// Shifts dated 2 days ago so they sit inside every analytics window (7/30/90).
const TWO_DAYS_AGO = Date.now() - 2 * 86_400_000;
const at = (hour: number, durationH: number): { starts_at: string; ends_at: string } => {
  const start = new Date(TWO_DAYS_AGO);
  start.setUTCHours(hour, 0, 0, 0);
  const end = new Date(start.getTime() + durationH * 3_600_000);
  return { starts_at: start.toISOString(), ends_at: end.toISOString() };
};

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

let owner = "";
let outsider = "";
let orgId = "";
let employeeId = "";
let scheduleId = "";
let clientOwner: SupabaseClient;
let clientOutsider: SupabaseClient;

beforeAll(async () => {
  owner = await seedUser("owner");
  outsider = await seedUser("outsider");
  orgId = await ownOrgId(owner);

  const emp = await admin
    .from("employees")
    .insert({ org_id: orgId, name: `Alex ${RUN}`, email: emailFor("emp"), active: true })
    .select("id")
    .single();
  if (emp.error) throw emp.error;
  employeeId = emp.data.id as string;

  const sched = await admin
    .from("schedules")
    .insert({ org_id: orgId, period_start: "2026-06-01", period_end: "2026-06-14", status: "published" })
    .select("id")
    .single();
  if (sched.error) throw sched.error;
  scheduleId = sched.data.id as string;

  // 2 assigned published shifts (8h span − 30m break = 7.5h each → 15h) + 1 open (4h).
  const a = at(9, 8);
  const b = at(0, 8); // a different UTC hour so they don't collide
  const open = at(18, 4);
  const shiftsRes = await admin
    .from("shifts")
    .insert([
      { org_id: orgId, schedule_id: scheduleId, employee_id: employeeId, status: "published", break_minutes: 30, ...a },
      { org_id: orgId, schedule_id: scheduleId, employee_id: employeeId, status: "published", break_minutes: 30, ...b },
      { org_id: orgId, schedule_id: scheduleId, employee_id: null, status: "open", break_minutes: 0, ...open },
    ])
    .select("id");
  if (shiftsRes.error) throw shiftsRes.error;
  const aShiftId = (shiftsRes.data![0] as { id: string }).id;

  const sick = await admin
    .from("sick_call_events")
    .insert({ org_id: orgId, employee_id: employeeId, shift_id: aShiftId, status: "open" });
  if (sick.error) throw sick.error;

  const offers = await admin.from("replacement_pool_events").insert([
    { org_id: orgId, shift_id: aShiftId, employee_id: employeeId, status: "accepted" },
    { org_id: orgId, shift_id: aShiftId, employee_id: employeeId, status: "declined" },
  ]);
  if (offers.error) throw offers.error;

  const swap = await admin
    .from("shift_swap_requests")
    .insert({ org_id: orgId, shift_id: aShiftId, requesting_employee_id: employeeId, status: "pending" });
  if (swap.error) throw swap.error;

  const timeOff = await admin.from("time_off_requests").insert({
    org_id: orgId,
    employee_id: employeeId,
    start_date: "2026-06-20",
    end_date: "2026-06-21",
    status: "pending",
  });
  if (timeOff.error) throw timeOff.error;

  clientOwner = await asUser(emailFor("owner"));
  clientOutsider = await asUser(emailFor("outsider"));
}, 45_000);

afterAll(async () => {
  await admin.from("schedules").delete().eq("id", scheduleId);
  await admin.from("employees").delete().eq("id", employeeId);
  await admin.from("sick_call_events").delete().eq("org_id", orgId);
  await admin.from("replacement_pool_events").delete().eq("org_id", orgId);
  await admin.from("shift_swap_requests").delete().eq("org_id", orgId);
  await admin.from("time_off_requests").delete().eq("org_id", orgId);
  await admin.auth.admin.deleteUser(owner).catch(() => {});
  await admin.auth.admin.deleteUser(outsider).catch(() => {});
});

describe("scheduling_analytics_overview", () => {
  it("aggregates the org's shifts + disruption events for a member", async () => {
    const { data, error } = await clientOwner
      .rpc("scheduling_analytics_overview", { p_org: orgId, p_days: 30 })
      .single();
    expect(error).toBeNull();
    const row = data as Record<string, unknown>;
    expect(Number(row.assigned_shifts)).toBe(2);
    expect(Number(row.open_shifts)).toBe(1);
    expect(Number(row.assigned_hours)).toBe(15);
    expect(Number(row.open_hours)).toBe(4);
    expect(Number(row.sick_calls)).toBe(1);
    expect(Number(row.offers)).toBe(2);
    expect(Number(row.offers_accepted)).toBe(1);
    expect(Number(row.swaps)).toBe(1);
    expect(Number(row.time_off)).toBe(1);
  });

  it("returns a zero row to a non-member (membership guard)", async () => {
    const { data, error } = await clientOutsider
      .rpc("scheduling_analytics_overview", { p_org: orgId, p_days: 30 })
      .single();
    expect(error).toBeNull();
    const row = data as Record<string, unknown>;
    expect(Number(row.assigned_shifts)).toBe(0);
    expect(Number(row.sick_calls)).toBe(0);
  });
});

describe("scheduling_analytics_by_employee", () => {
  it("returns the seeded employee's rollup for a member", async () => {
    const { data, error } = await clientOwner.rpc("scheduling_analytics_by_employee", {
      p_org: orgId,
      p_days: 30,
    });
    expect(error).toBeNull();
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const mine = rows.find((r) => r.employee_id === employeeId);
    expect(mine).toBeDefined();
    expect(Number(mine!.assigned_shifts)).toBe(2);
    expect(Number(mine!.assigned_hours)).toBe(15);
    expect(Number(mine!.sick_calls)).toBe(1);
    expect(Number(mine!.offers_accepted)).toBe(1);
  });

  it("returns no rows to a non-member (membership guard)", async () => {
    const { data, error } = await clientOutsider.rpc("scheduling_analytics_by_employee", {
      p_org: orgId,
      p_days: 30,
    });
    expect(error).toBeNull();
    expect((data ?? []) as unknown[]).toHaveLength(0);
  });
});
