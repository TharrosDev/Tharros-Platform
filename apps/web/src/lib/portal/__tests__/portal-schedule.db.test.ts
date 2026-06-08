import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Day 53 — portal schedule read scoping harness.
 *
 * `getPortalSchedule` reads via the service-role admin client scoped to the
 * session's employee + org. This replicates that query against the CI Supabase
 * project (the module itself is `server-only`, so it can't be imported under
 * Vitest) and proves the filter: only the target employee's PUBLISHED, in-window
 * shifts come back — not another employee's, not drafts, not out-of-window.
 * Provider-free. Run with `pnpm --filter @tharros/web test`.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY!;

const PASSWORD = "Test-Pw-Day53-aA1!";
const RUN = Date.now().toString(36);
const emailFor = (who: string) => `portal-sched-${RUN}-${who}@tharros-sched.test`;

const admin = createClient(SUPABASE_URL, SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const WINDOW_DAYS = 14;
const DAY = 24 * 60 * 60 * 1000;
const isoIn = (days: number) => new Date(Date.now() + days * DAY).toISOString();

let ownerId = "";
let orgA = "";
let emp1 = "";
let emp2 = "";
let scheduleId = "";

async function getPortalSchedule(employeeId: string, orgId: string) {
  const now = new Date();
  const until = new Date(now.getTime() + WINDOW_DAYS * DAY);
  const { data } = await admin
    .from("shifts")
    .select("id, starts_at, ends_at, status, employee_id")
    .eq("employee_id", employeeId)
    .eq("org_id", orgId)
    .eq("status", "published")
    .gte("starts_at", now.toISOString())
    .lt("starts_at", until.toISOString())
    .order("starts_at", { ascending: true });
  return data ?? [];
}

beforeAll(async () => {
  const { data: u, error: uErr } = await admin.auth.admin.createUser({
    email: emailFor("owner"),
    password: PASSWORD,
    email_confirm: true,
  });
  if (uErr) throw uErr;
  ownerId = u.user.id;

  const { data: m, error: mErr } = await admin
    .from("memberships")
    .select("org_id")
    .eq("user_id", ownerId)
    .eq("role", "owner")
    .single();
  if (mErr) throw mErr;
  orgA = m.org_id as string;

  const { data: emps, error: eErr } = await admin
    .from("employees")
    .insert([
      { org_id: orgA, name: "Emp One", email: `e1-${RUN}@tharros-sched.test` },
      { org_id: orgA, name: "Emp Two", email: `e2-${RUN}@tharros-sched.test` },
    ])
    .select("id");
  if (eErr) throw eErr;
  emp1 = emps![0].id as string;
  emp2 = emps![1].id as string;

  const { data: sched, error: sErr } = await admin
    .from("schedules")
    .insert({
      org_id: orgA,
      name: "Delivery sched",
      period_start: isoIn(0).slice(0, 10),
      period_end: isoIn(30).slice(0, 10),
      status: "published",
    })
    .select("id")
    .single();
  if (sErr) throw sErr;
  scheduleId = sched!.id as string;

  const mk = (employeeId: string, startDays: number, status: string) => ({
    org_id: orgA,
    schedule_id: scheduleId,
    employee_id: employeeId,
    starts_at: isoIn(startDays),
    ends_at: isoIn(startDays + 0.33),
    break_minutes: 0,
    status,
  });
  const { error: shErr } = await admin.from("shifts").insert([
    mk(emp1, 2, "published"), // in window, emp1 → expected
    mk(emp1, 3, "draft"), // draft → excluded
    mk(emp1, 30, "published"), // out of window → excluded
    mk(emp2, 2, "published"), // other employee → excluded
  ]);
  if (shErr) throw shErr;
}, 30_000);

afterAll(async () => {
  if (scheduleId) await admin.from("schedules").delete().eq("id", scheduleId);
  if (emp1) await admin.from("employees").delete().eq("id", emp1);
  if (emp2) await admin.from("employees").delete().eq("id", emp2);
  await admin.auth.admin.deleteUser(ownerId).catch(() => {});
});

describe("portal schedule read scoping", () => {
  it("returns only the employee's published, in-window shifts", async () => {
    const rows = await getPortalSchedule(emp1, orgA);
    expect(rows).toHaveLength(1);
    expect(rows[0].employee_id).toBe(emp1);
    expect(rows[0].status).toBe("published");
  });

  it("returns the other employee's own shift, not the first employee's", async () => {
    const rows = await getPortalSchedule(emp2, orgA);
    expect(rows).toHaveLength(1);
    expect(rows[0].employee_id).toBe(emp2);
  });
});
