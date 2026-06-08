import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { acceptOffer, escalateReplacement, openReplacement } from "@/lib/scheduling/replacement";

/**
 * Day 55 — replacement engine harness (live, against the CI Supabase project).
 *
 * Proves the end-to-end DB behaviour the pure tests can't: `openReplacement` fans
 * out offers + arms the timeout, the `claim_replacement_offer` RPC is genuinely
 * first-accept-wins under concurrency (two parallel claims → exactly one winner),
 * and escalation expires offers + notifies managers (and no-ops once filled).
 * Provider-free. Run with `pnpm --filter @tharros/web test`.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY!;

const PASSWORD = "Test-Pw-Day55-aA1!";
const RUN = Date.now().toString(36);
const emailFor = (who: string) => `replacement-${RUN}-${who}@tharros-sched.test`;

const admin = createClient(SUPABASE_URL, SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const DAY = 24 * 60 * 60 * 1000;
const isoIn = (days: number) => new Date(Date.now() + days * DAY).toISOString();

let ownerId = "";
let orgA = "";
let emp1 = "";
let emp2 = "";
let scheduleId = "";

/** Create an OPEN shift (no assignee) `days` out, and offer it to both employees. */
async function openShiftWithOffers(
  days: number,
  opts: { withSickCall?: boolean } = {},
): Promise<{ shiftId: string; sickCallId: string | null; offerIds: string[] }> {
  const startsAt = isoIn(days);
  const { data: shift, error: sErr } = await admin
    .from("shifts")
    .insert({
      org_id: orgA,
      schedule_id: scheduleId,
      employee_id: null,
      starts_at: startsAt,
      ends_at: new Date(Date.parse(startsAt) + 4 * 60 * 60 * 1000).toISOString(),
      break_minutes: 0,
      status: "open",
    })
    .select("id")
    .single();
  if (sErr) throw sErr;
  const shiftId = shift!.id as string;

  let sickCallId: string | null = null;
  if (opts.withSickCall) {
    const { data: sc, error: scErr } = await admin
      .from("sick_call_events")
      .insert({ org_id: orgA, employee_id: emp1, shift_id: shiftId, status: "open" })
      .select("id")
      .single();
    if (scErr) throw scErr;
    sickCallId = sc!.id as string;
  }

  const { data: offers, error: oErr } = await admin
    .from("replacement_pool_events")
    .insert(
      [emp1, emp2].map((employee_id) => ({
        org_id: orgA,
        shift_id: shiftId,
        sick_call_id: sickCallId,
        employee_id,
        status: "offered",
        expires_at: isoIn(days),
      })),
    )
    .select("id, employee_id");
  if (oErr) throw oErr;
  const offerIds = (offers ?? []).map((o) => o.id as string);
  return { shiftId, sickCallId, offerIds };
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
      { org_id: orgA, name: "Avery Pool", email: `r1-${RUN}@tharros-sched.test` },
      { org_id: orgA, name: "Blake Pool", email: `r2-${RUN}@tharros-sched.test` },
    ])
    .select("id");
  if (eErr) throw eErr;
  emp1 = emps![0].id as string;
  emp2 = emps![1].id as string;

  const { data: sched, error: schErr } = await admin
    .from("schedules")
    .insert({
      org_id: orgA,
      name: "Replacement sched",
      period_start: isoIn(0).slice(0, 10),
      period_end: isoIn(30).slice(0, 10),
      status: "published",
    })
    .select("id")
    .single();
  if (schErr) throw schErr;
  scheduleId = sched!.id as string;

  // Both employees are available all day on every offered date (whole-day temporary
  // override spanning the test window), so the eligibility filter passes them.
  const { error: avErr } = await admin.from("availability").insert(
    [emp1, emp2].map((employee_id) => ({
      org_id: orgA,
      employee_id,
      kind: "temporary",
      effective_date: isoIn(0).slice(0, 10),
      end_date: isoIn(30).slice(0, 10),
      is_available: true,
      start_time: null,
      end_time: null,
    })),
  );
  if (avErr) throw avErr;
}, 30_000);

afterAll(async () => {
  if (orgA) {
    await admin.from("replacement_pool_events").delete().eq("org_id", orgA);
    await admin.from("sick_call_events").delete().eq("org_id", orgA);
    await admin.from("notification_events").delete().eq("org_id", orgA);
    await admin.from("scheduling_audit_log").delete().eq("org_id", orgA);
    await admin.from("jobs").delete().eq("org_id", orgA);
    await admin.from("availability").delete().eq("org_id", orgA);
  }
  if (scheduleId) await admin.from("schedules").delete().eq("id", scheduleId);
  if (emp1) await admin.from("employees").delete().eq("id", emp1);
  if (emp2) await admin.from("employees").delete().eq("id", emp2);
  await admin.auth.admin.deleteUser(ownerId).catch(() => {});
});

describe("openReplacement", () => {
  it("offers an open shift to every eligible employee, moves the sick-call to filling, and arms the timeout", async () => {
    // A fresh open shift (no offers yet) + a sick-call to fill.
    const startsAt = isoIn(6);
    const { data: shift } = await admin
      .from("shifts")
      .insert({
        org_id: orgA,
        schedule_id: scheduleId,
        employee_id: null,
        starts_at: startsAt,
        ends_at: new Date(Date.parse(startsAt) + 4 * 60 * 60 * 1000).toISOString(),
        break_minutes: 0,
        status: "open",
      })
      .select("id")
      .single();
    const shiftId = shift!.id as string;
    const { data: sc } = await admin
      .from("sick_call_events")
      .insert({ org_id: orgA, employee_id: emp1, shift_id: shiftId, status: "open" })
      .select("id")
      .single();
    const sickCallId = sc!.id as string;

    const res = await openReplacement(admin, { shiftId, orgId: orgA, sickCallId, vacatedBy: emp1 });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // emp1 called out → only emp2 is offered.
    expect(res.offered).toBe(1);
    expect(res.status).toBe("offered");

    const { data: offers } = await admin
      .from("replacement_pool_events")
      .select("employee_id, status, expires_at")
      .eq("shift_id", shiftId);
    expect((offers ?? []).length).toBe(1);
    expect(offers![0].employee_id).toBe(emp2);
    expect(offers![0].status).toBe("offered");
    expect(offers![0].expires_at).toBeTruthy();

    const { data: scAfter } = await admin
      .from("sick_call_events")
      .select("status")
      .eq("id", sickCallId)
      .single();
    expect(scAfter!.status).toBe("filling");

    const { data: jobs } = await admin
      .from("jobs")
      .select("type")
      .eq("org_id", orgA)
      .eq("payload->>shiftId", shiftId);
    const types = (jobs ?? []).map((j) => j.type);
    expect(types).toContain("replacement-offer-timeout");
  });
});

describe("claim_replacement_offer (first-accept-wins)", () => {
  it("lets exactly one of two concurrent claims win", async () => {
    const { shiftId, offerIds } = await openShiftWithOffers(7);
    const { data: offerRows } = await admin
      .from("replacement_pool_events")
      .select("id, employee_id")
      .in("id", offerIds);
    const byEmp = new Map((offerRows ?? []).map((o) => [o.employee_id as string, o.id as string]));

    // Two claims fired together; the shift row lock serializes them.
    const [a, b] = await Promise.all([
      admin.rpc("claim_replacement_offer", {
        p_offer_id: byEmp.get(emp1),
        p_employee_id: emp1,
        p_org_id: orgA,
      }),
      admin.rpc("claim_replacement_offer", {
        p_offer_id: byEmp.get(emp2),
        p_employee_id: emp2,
        p_org_id: orgA,
      }),
    ]);
    const outcomes = [a.data?.[0]?.outcome, b.data?.[0]?.outcome].sort();
    expect(outcomes).toEqual(["accepted", "already_filled"]);

    // The shift is assigned to exactly one of them and republished.
    const { data: shift } = await admin
      .from("shifts")
      .select("employee_id, status")
      .eq("id", shiftId)
      .single();
    expect([emp1, emp2]).toContain(shift!.employee_id);
    expect(shift!.status).toBe("published");

    // One offer accepted, the other expired.
    const { data: offers } = await admin
      .from("replacement_pool_events")
      .select("status")
      .eq("shift_id", shiftId);
    const statuses = (offers ?? []).map((o) => o.status).sort();
    expect(statuses).toEqual(["accepted", "expired"]);
  });

  it("acceptOffer resolves the originating sick-call and rejects a stale claim", async () => {
    const { shiftId, sickCallId, offerIds } = await openShiftWithOffers(8, { withSickCall: true });
    const { data: offerRows } = await admin
      .from("replacement_pool_events")
      .select("id, employee_id")
      .in("id", offerIds);
    const byEmp = new Map((offerRows ?? []).map((o) => [o.employee_id as string, o.id as string]));

    const win = await acceptOffer(admin, { offerId: byEmp.get(emp1)!, employeeId: emp1, orgId: orgA });
    expect(win.ok).toBe(true);
    if (win.ok) expect(win.shiftId).toBe(shiftId);

    const { data: sc } = await admin
      .from("sick_call_events")
      .select("status, resolution")
      .eq("id", sickCallId!)
      .single();
    expect(sc!.status).toBe("resolved");

    // emp2's offer is now expired → claiming it loses.
    const lose = await acceptOffer(admin, { offerId: byEmp.get(emp2)!, employeeId: emp2, orgId: orgA });
    expect(lose.ok).toBe(false);
  });
});

describe("escalateReplacement", () => {
  it("expires outstanding offers, escalates the sick-call, and notifies managers", async () => {
    const { shiftId, sickCallId } = await openShiftWithOffers(9, { withSickCall: true });

    const res = await escalateReplacement(admin, {
      shiftId,
      orgId: orgA,
      sickCallId,
      reason: "timeout",
    });
    expect(res.escalated).toBe(true);

    const { data: offers } = await admin
      .from("replacement_pool_events")
      .select("status")
      .eq("shift_id", shiftId);
    expect((offers ?? []).every((o) => o.status === "expired")).toBe(true);

    const { data: sc } = await admin
      .from("sick_call_events")
      .select("status")
      .eq("id", sickCallId!)
      .single();
    expect(sc!.status).toBe("escalated");

    const { data: notes } = await admin
      .from("notification_events")
      .select("user_id, type")
      .eq("org_id", orgA)
      .eq("type", "replacement_escalated");
    expect((notes ?? []).some((n) => n.user_id === ownerId)).toBe(true);
  });

  it("no-ops when the shift is already filled", async () => {
    const { shiftId } = await openShiftWithOffers(10);
    // Mark the shift filled (as if someone accepted).
    await admin.from("shifts").update({ employee_id: emp1, status: "published" }).eq("id", shiftId);

    const res = await escalateReplacement(admin, { shiftId, orgId: orgA, reason: "timeout" });
    expect(res.escalated).toBe(false);
  });
});
