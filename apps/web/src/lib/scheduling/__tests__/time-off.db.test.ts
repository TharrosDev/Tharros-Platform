import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  approveTimeOff,
  denyTimeOff,
  getPendingTimeOff,
  processTimeOffRequest,
  reverseTimeOff,
} from "@/lib/scheduling/time-off";

/**
 * Day 57 — time-off harness (live, against the CI Supabase project).
 *
 * Proves the DB behaviour the pure tests can't: a no-conflict request auto-approves
 * and notifies managers; a coverable conflict is low/auto-approved; a role-gated shift
 * with no eligible cover is high/pending (then a manager approves + reverses); the
 * policy can force everything through a manager; and a manager can deny a pending
 * request. Provider-free (no DeepSeek dep). Run with `pnpm --filter @tharros/web test`.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY!;

const RUN = Date.now().toString(36);
const admin = createClient(SUPABASE_URL, SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const DAY = 24 * 60 * 60 * 1000;
const isoIn = (days: number) => new Date(Date.now() + days * DAY).toISOString();
const dateIn = (days: number) => isoIn(days).slice(0, 10);

let ownerId = "";
let orgA = "";
let empA = "";
let empB = "";
let scheduleId = "";
let roleId = "";

/**
 * A published shift `days` out at a fixed 09:00–13:00 UTC window, assigned to
 * `employeeId`, optionally requiring a role. The fixed wall clock (vs the current
 * time-of-day) keeps the shift inside a single UTC day so the whole-day availability
 * grants it deterministically.
 */
async function shift(
  employeeId: string,
  days: number,
  roleCertId: string | null = null,
): Promise<string> {
  const date = dateIn(days);
  const { data, error } = await admin
    .from("shifts")
    .insert({
      org_id: orgA,
      schedule_id: scheduleId,
      employee_id: employeeId,
      role_certification_id: roleCertId,
      starts_at: `${date}T09:00:00Z`,
      ends_at: `${date}T13:00:00Z`,
      break_minutes: 0,
      status: "published",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data!.id as string;
}

async function requestStatus(
  requestId: string,
): Promise<{ status: string; band: string | null; auto: boolean }> {
  const { data } = await admin
    .from("time_off_requests")
    .select("status, impact_band, auto_decided")
    .eq("id", requestId)
    .single();
  const r = data as { status: string; impact_band: string | null; auto_decided: boolean };
  return { status: r.status, band: r.impact_band, auto: r.auto_decided };
}

beforeAll(async () => {
  const { data: u, error: uErr } = await admin.auth.admin.createUser({
    email: `timeoff-${RUN}-owner@tharros-sched.test`,
    password: "Test-Pw-Day57-aA1!",
    email_confirm: true,
  });
  if (uErr) throw uErr;
  ownerId = u.user.id;

  const { data: m } = await admin
    .from("memberships")
    .select("org_id")
    .eq("user_id", ownerId)
    .eq("role", "owner")
    .single();
  orgA = (m as { org_id: string }).org_id;

  const { data: emps, error: eErr } = await admin
    .from("employees")
    .insert([
      { org_id: orgA, name: "Ada Leave", email: `a-${RUN}@tharros-sched.test` },
      { org_id: orgA, name: "Ben Leave", email: `b-${RUN}@tharros-sched.test` },
    ])
    .select("id");
  if (eErr) throw eErr;
  empA = emps![0].id as string;
  empB = emps![1].id as string;

  const { data: role } = await admin
    .from("roles_certifications")
    .insert({ org_id: orgA, name: `Lead ${RUN}`, kind: "role" })
    .select("id")
    .single();
  roleId = (role as { id: string }).id;
  // Only A holds the role (used for the uncoverable / high-impact case).
  await admin
    .from("employee_role_assignments")
    .insert({ org_id: orgA, employee_id: empA, role_certification_id: roleId });

  const { data: sched } = await admin
    .from("schedules")
    .insert({
      org_id: orgA,
      name: "Leave sched",
      period_start: dateIn(0),
      period_end: dateIn(60),
      status: "published",
    })
    .select("id")
    .single();
  scheduleId = (sched as { id: string }).id;

  // Both available across the whole window (whole-day temporary override).
  await admin.from("availability").insert(
    [empA, empB].map((employee_id) => ({
      org_id: orgA,
      employee_id,
      kind: "temporary",
      effective_date: dateIn(0),
      end_date: dateIn(60),
      is_available: true,
      start_time: null,
      end_time: null,
    })),
  );
}, 30_000);

afterAll(async () => {
  if (orgA) {
    await admin.from("time_off_requests").delete().eq("org_id", orgA);
    await admin.from("shifts").delete().eq("org_id", orgA);
    await admin.from("agent_turns").delete().eq("org_id", orgA);
    await admin.from("ai_conversation_threads").delete().eq("org_id", orgA);
    await admin.from("notification_events").delete().eq("org_id", orgA);
    await admin.from("scheduling_audit_log").delete().eq("org_id", orgA);
    await admin.from("availability").delete().eq("org_id", orgA);
    await admin.from("employee_role_assignments").delete().eq("org_id", orgA);
  }
  if (scheduleId) await admin.from("schedules").delete().eq("id", scheduleId);
  for (const id of [empA, empB]) if (id) await admin.from("employees").delete().eq("id", id);
  if (roleId) await admin.from("roles_certifications").delete().eq("id", roleId);
  await admin.auth.admin.deleteUser(ownerId).catch(() => {});
});

describe("time-off requests", () => {
  it("auto-approves a no-conflict request and notifies managers", async () => {
    const res = await processTimeOffRequest(admin, {
      employeeId: empB,
      orgId: orgA,
      employeeName: "Ben Leave",
      startDate: dateIn(3),
      endDate: dateIn(4),
      reasonText: "Long weekend",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.status).toBe("approved");
    expect(res.band).toBe("low");

    const row = await requestStatus(res.requestId);
    expect(row).toEqual({ status: "approved", band: "low", auto: true });

    // The owner got a time_off_requested notification.
    const { data: notes } = await admin
      .from("notification_events")
      .select("user_id, type")
      .eq("org_id", orgA)
      .eq("type", "time_off_requested");
    expect((notes ?? []).some((n) => n.user_id === ownerId)).toBe(true);

    // The request was audited.
    const { data: audit } = await admin
      .from("scheduling_audit_log")
      .select("action")
      .eq("org_id", orgA)
      .eq("entity_id", res.requestId)
      .eq("action", "time_off.requested");
    expect((audit ?? []).length).toBe(1);
  });

  it("auto-approves when the conflicting shift has eligible cover (low)", async () => {
    // A has a no-role shift in the window; B is available + role-free → can cover.
    await shift(empA, 6);
    const res = await processTimeOffRequest(admin, {
      employeeId: empA,
      orgId: orgA,
      employeeName: "Ada Leave",
      startDate: dateIn(6),
      endDate: dateIn(6),
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.band).toBe("low");
    expect(res.status).toBe("approved");
  });

  it("leaves a high-impact request pending, then a manager approves + reverses it", async () => {
    // A holds a role-gated shift only A can work → nobody can cover → high.
    await shift(empA, 8, roleId);
    const res = await processTimeOffRequest(admin, {
      employeeId: empA,
      orgId: orgA,
      employeeName: "Ada Leave",
      startDate: dateIn(8),
      endDate: dateIn(8),
      reasonText: "Appointment",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.band).toBe("high");
    expect(res.status).toBe("pending");

    // It surfaces in the manager pane with the recommendation.
    const pending = await getPendingTimeOff(admin, orgA);
    const mine = pending.find((p) => p.id === res.requestId);
    expect(mine?.status).toBe("pending");
    expect(mine?.impactBand).toBe("high");
    expect(mine?.recommendation).toBeTruthy();
    expect(mine?.employeeName).toBe("Ada Leave");

    // Manager approves.
    const approved = await approveTimeOff(admin, {
      orgId: orgA,
      requestId: res.requestId,
      reviewerUserId: ownerId,
    });
    expect(approved).toEqual({ ok: true, outcome: "approved" });
    expect((await requestStatus(res.requestId)).status).toBe("approved");

    // Manager reverses the approval.
    const reversed = await reverseTimeOff(admin, {
      orgId: orgA,
      requestId: res.requestId,
      reviewerUserId: ownerId,
    });
    expect(reversed).toEqual({ ok: true, outcome: "denied" });
    expect((await requestStatus(res.requestId)).status).toBe("denied");
  });

  it("keeps a low-impact request pending when the org disables auto-approve", async () => {
    await admin.from("org_settings").upsert(
      {
        org_id: orgA,
        time_off_policy: { autoApproveLowImpact: false, escalateHighImpact: true },
      },
      { onConflict: "org_id" },
    );

    const res = await processTimeOffRequest(admin, {
      employeeId: empB,
      orgId: orgA,
      employeeName: "Ben Leave",
      startDate: dateIn(12),
      endDate: dateIn(12),
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.band).toBe("low");
    expect(res.status).toBe("pending");

    // Manager denies it.
    const denied = await denyTimeOff(admin, {
      orgId: orgA,
      requestId: res.requestId,
      reviewerUserId: ownerId,
    });
    expect(denied).toEqual({ ok: true, outcome: "denied" });
    expect((await requestStatus(res.requestId)).status).toBe("denied");

    // Restore the default policy for any later assertions.
    await admin
      .from("org_settings")
      .upsert(
        { org_id: orgA, time_off_policy: { autoApproveLowImpact: true, escalateHighImpact: true } },
        { onConflict: "org_id" },
      );
  });

  it("rejects an invalid date range", async () => {
    const res = await processTimeOffRequest(admin, {
      employeeId: empB,
      orgId: orgA,
      employeeName: "Ben Leave",
      startDate: dateIn(10),
      endDate: dateIn(9), // end before start
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe("invalid_dates");
  });
});
