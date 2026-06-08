import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { approveSwap, proposeSwap, respondToSwap } from "@/lib/scheduling/swaps";

/**
 * Day 56 — shift-swap harness (live, against the CI Supabase project).
 *
 * Proves the DB behaviour the pure tests can't: a valid trade auto-applies (both
 * shifts reassign), an invalid swap escalates + notifies managers + a manager
 * override applies it, an open offer is first-claim-wins under concurrency, and a
 * stale shift is rejected. Provider-free. Run with `pnpm --filter @tharros/web test`.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY!;

const RUN = Date.now().toString(36);
const admin = createClient(SUPABASE_URL, SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const DAY = 24 * 60 * 60 * 1000;
const isoIn = (days: number) => new Date(Date.now() + days * DAY).toISOString();

let ownerId = "";
let orgA = "";
let empA = "";
let empB = "";
let empC = "";
let scheduleId = "";
let roleId = "";

/**
 * A published shift `days` out at a fixed 09:00–13:00 UTC window, assigned to
 * `employeeId`, optionally requiring a role. The fixed wall clock (vs the current
 * time-of-day) keeps the shift inside a single UTC day so the whole-day availability
 * grants it deterministically — `isoIn(days)` would cross midnight when CI runs late
 * in the UTC day, flakily making nobody eligible.
 */
async function shift(employeeId: string, days: number, roleCertId: string | null = null): Promise<string> {
  const date = isoIn(days).slice(0, 10);
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

async function shiftOwner(shiftId: string): Promise<string | null> {
  const { data } = await admin.from("shifts").select("employee_id").eq("id", shiftId).single();
  return (data as { employee_id: string | null }).employee_id;
}

beforeAll(async () => {
  const { data: u, error: uErr } = await admin.auth.admin.createUser({
    email: `swap-${RUN}-owner@tharros-sched.test`,
    password: "Test-Pw-Day56-aA1!",
    email_confirm: true,
  });
  if (uErr) throw uErr;
  ownerId = u.user.id;

  const { data: m } = await admin.from("memberships").select("org_id").eq("user_id", ownerId).eq("role", "owner").single();
  orgA = (m as { org_id: string }).org_id;

  const { data: emps, error: eErr } = await admin
    .from("employees")
    .insert([
      { org_id: orgA, name: "Ada Swap", email: `a-${RUN}@tharros-sched.test` },
      { org_id: orgA, name: "Ben Swap", email: `b-${RUN}@tharros-sched.test` },
      { org_id: orgA, name: "Cy Swap", email: `c-${RUN}@tharros-sched.test` },
    ])
    .select("id");
  if (eErr) throw eErr;
  empA = emps![0].id as string;
  empB = emps![1].id as string;
  empC = emps![2].id as string;

  const { data: role } = await admin
    .from("roles_certifications")
    .insert({ org_id: orgA, name: `Lead ${RUN}`, kind: "role" })
    .select("id")
    .single();
  roleId = (role as { id: string }).id;
  // Only A holds the role (used for the invalid-swap / escalation case).
  await admin.from("employee_role_assignments").insert({ org_id: orgA, employee_id: empA, role_certification_id: roleId });

  const { data: sched } = await admin
    .from("schedules")
    .insert({ org_id: orgA, name: "Swap sched", period_start: isoIn(0).slice(0, 10), period_end: isoIn(40).slice(0, 10), status: "published" })
    .select("id")
    .single();
  scheduleId = (sched as { id: string }).id;

  // All three available across the whole window (whole-day temporary override).
  await admin.from("availability").insert(
    [empA, empB, empC].map((employee_id) => ({
      org_id: orgA,
      employee_id,
      kind: "temporary",
      effective_date: isoIn(0).slice(0, 10),
      end_date: isoIn(40).slice(0, 10),
      is_available: true,
      start_time: null,
      end_time: null,
    })),
  );
}, 30_000);

afterAll(async () => {
  if (orgA) {
    await admin.from("shift_swap_requests").delete().eq("org_id", orgA);
    await admin.from("notification_events").delete().eq("org_id", orgA);
    await admin.from("scheduling_audit_log").delete().eq("org_id", orgA);
    await admin.from("jobs").delete().eq("org_id", orgA);
    await admin.from("availability").delete().eq("org_id", orgA);
    await admin.from("employee_role_assignments").delete().eq("org_id", orgA);
  }
  if (scheduleId) await admin.from("schedules").delete().eq("id", scheduleId);
  for (const id of [empA, empB, empC]) if (id) await admin.from("employees").delete().eq("id", id);
  if (roleId) await admin.from("roles_certifications").delete().eq("id", roleId);
  await admin.auth.admin.deleteUser(ownerId).catch(() => {});
});

describe("shift swaps", () => {
  it("auto-applies a valid two-shift trade", async () => {
    const x = await shift(empA, 3); // A's, no role
    const y = await shift(empB, 4); // B's, no role

    const proposed = await proposeSwap(admin, {
      orgId: orgA,
      requestingEmployeeId: empA,
      shiftId: x,
      targetEmployeeId: empB,
      targetShiftId: y,
    });
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) return;

    const res = await respondToSwap(admin, { orgId: orgA, requestId: proposed.requestId, claimantId: empB, accept: true });
    expect(res).toEqual({ ok: true, outcome: "applied" });

    expect(await shiftOwner(x)).toBe(empB); // X went to B
    expect(await shiftOwner(y)).toBe(empA); // Y went to A

    const { data: req } = await admin.from("shift_swap_requests").select("status").eq("id", proposed.requestId).single();
    expect((req as { status: string }).status).toBe("approved");
  });

  it("escalates an invalid swap, then a manager override applies it", async () => {
    const x = await shift(empA, 5, roleId); // requires the role only A holds

    // Handoff to B, who lacks the role → validateSwap invalid → escalate.
    const proposed = await proposeSwap(admin, {
      orgId: orgA,
      requestingEmployeeId: empA,
      shiftId: x,
      targetEmployeeId: empB,
    });
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) return;

    const res = await respondToSwap(admin, { orgId: orgA, requestId: proposed.requestId, claimantId: empB, accept: true });
    expect(res).toEqual({ ok: true, outcome: "escalated" });

    const { data: req } = await admin.from("shift_swap_requests").select("status, target_employee_id").eq("id", proposed.requestId).single();
    expect((req as { status: string }).status).toBe("accepted");
    expect((req as { target_employee_id: string }).target_employee_id).toBe(empB);
    expect(await shiftOwner(x)).toBe(empA); // not yet moved

    // The owner/admin got a swap_escalated notification.
    const { data: notes } = await admin
      .from("notification_events")
      .select("user_id, type")
      .eq("org_id", orgA)
      .eq("type", "swap_escalated");
    expect((notes ?? []).some((n) => n.user_id === ownerId)).toBe(true);

    // Manager override applies it despite the role gap.
    const approved = await approveSwap(admin, { orgId: orgA, requestId: proposed.requestId, reviewerUserId: ownerId });
    expect(approved).toEqual({ ok: true, outcome: "applied" });
    expect(await shiftOwner(x)).toBe(empB);
  });

  it("open offer is first-claim-wins under concurrency", async () => {
    const x = await shift(empA, 7); // A's open offer, no role

    const proposed = await proposeSwap(admin, { orgId: orgA, requestingEmployeeId: empA, shiftId: x });
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) return;

    // B and C both try to claim it at once.
    const [b, c] = await Promise.all([
      respondToSwap(admin, { orgId: orgA, requestId: proposed.requestId, claimantId: empB, accept: true }),
      respondToSwap(admin, { orgId: orgA, requestId: proposed.requestId, claimantId: empC, accept: true }),
    ]);
    const applied = [b, c].filter((r) => r.ok && r.outcome === "applied");
    const losers = [b, c].filter((r) => !r.ok || r.outcome !== "applied");
    expect(applied).toHaveLength(1);
    expect(losers).toHaveLength(1);

    // X went to exactly one of them.
    expect([empB, empC]).toContain(await shiftOwner(x));
  });

  it("rejects as stale when the shift changed underneath", async () => {
    const x = await shift(empA, 9);
    const proposed = await proposeSwap(admin, { orgId: orgA, requestingEmployeeId: empA, shiftId: x });
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) return;

    // The shift gets reassigned away from A before the claim resolves.
    await admin.from("shifts").update({ employee_id: empC }).eq("id", x);

    const res = await respondToSwap(admin, { orgId: orgA, requestId: proposed.requestId, claimantId: empB, accept: true });
    expect(res.ok).toBe(false);
  });
});
