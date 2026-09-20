import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/observability/logger";
import { resolveSickCallReasonPolicy, type SickCallReasonPolicy } from "@/lib/scheduling/sick-call";

/**
 * Day 53 — the employee's hosted portal schedule (next 2 weeks of published
 * shifts). The portal is account-less: the caller resolves the employee + org
 * from the validated cookie session (`getPortalSession`) and passes them here.
 * Reads via the service-role admin client scoped strictly to that session
 * (mirrors the Day-45 availability-save pattern) — anon RLS does not apply.
 */

export type PortalShift = {
  id: string;
  startsAt: string;
  endsAt: string;
  breakMinutes: number;
  roleName: string | null;
  notes: string | null;
};

const WINDOW_DAYS = 14;

export async function getPortalSchedule(employeeId: string, orgId: string): Promise<PortalShift[]> {
  const admin = createAdminClient();
  const now = new Date();
  const until = new Date(now.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const { data, error } = await admin
    .from("shifts")
    .select("id, starts_at, ends_at, break_minutes, notes, roles_certifications(name)")
    .eq("employee_id", employeeId)
    .eq("org_id", orgId)
    .eq("status", "published")
    .gte("starts_at", now.toISOString())
    .lt("starts_at", until.toISOString())
    .order("starts_at", { ascending: true });

  if (error) {
    logger.error("getPortalSchedule: query failed", { err: error, employeeId });
    return [];
  }

  return (
    (data ?? []) as unknown as Array<{
      id: string;
      starts_at: string;
      ends_at: string;
      break_minutes: number | null;
      notes: string | null;
      roles_certifications: { name: string } | { name: string }[] | null;
    }>
  ).map((r) => {
    const rc = Array.isArray(r.roles_certifications)
      ? r.roles_certifications[0]
      : r.roles_certifications;
    return {
      id: r.id,
      startsAt: r.starts_at,
      endsAt: r.ends_at,
      breakMinutes: Number(r.break_minutes ?? 0),
      roleName: rc?.name ?? null,
      notes: r.notes ?? null,
    };
  });
}

/** An open shift offered to this employee that they can still pick up (Day 55). */
export type OpenOffer = {
  offerId: string;
  shiftId: string;
  startsAt: string;
  endsAt: string;
  breakMinutes: number;
  roleName: string | null;
  expiresAt: string | null;
};

/**
 * Day 55 — the open shifts this employee has a live offer to pick up. Scoped to the
 * session's employee + org via the admin client (auth-light portal, no RLS). Filters
 * to still-`offered` rows whose shift is still `open` and in the future; whoever
 * accepts first on the portal wins via the atomic RPC.
 */
export async function getOpenOffers(employeeId: string, orgId: string): Promise<OpenOffer[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("replacement_pool_events")
    .select(
      "id, expires_at, shifts!inner(id, starts_at, ends_at, break_minutes, status, employee_id, roles_certifications(name))",
    )
    .eq("employee_id", employeeId)
    .eq("org_id", orgId)
    .eq("status", "offered")
    .order("offered_at", { ascending: true });

  if (error) {
    logger.error("getOpenOffers: query failed", { err: error, employeeId });
    return [];
  }

  type ShiftJoin = {
    id: string;
    starts_at: string;
    ends_at: string;
    break_minutes: number | null;
    status: string;
    employee_id: string | null;
    roles_certifications: { name: string } | { name: string }[] | null;
  };

  return (
    (data ?? []) as unknown as Array<{
      id: string;
      expires_at: string | null;
      shifts: ShiftJoin | ShiftJoin[] | null;
    }>
  )
    .map((r) => {
      const shift = Array.isArray(r.shifts) ? r.shifts[0] : r.shifts;
      if (!shift) return null;
      // Only a still-open, future shift is offerable.
      if (shift.status !== "open" || shift.employee_id !== null) return null;
      const startMs = Date.parse(shift.starts_at);
      if (Number.isNaN(startMs) || startMs <= Date.now()) return null;
      const rc = Array.isArray(shift.roles_certifications)
        ? shift.roles_certifications[0]
        : shift.roles_certifications;
      return {
        offerId: r.id,
        shiftId: shift.id,
        startsAt: shift.starts_at,
        endsAt: shift.ends_at,
        breakMinutes: Number(shift.break_minutes ?? 0),
        roleName: rc?.name ?? null,
        expiresAt: r.expires_at,
      } satisfies OpenOffer;
    })
    .filter((o): o is OpenOffer => o !== null);
}

/** The org's sick-call reason policy (Day 54), read from org_settings.agent_persona. */
export async function getSickCallReasonPolicy(orgId: string): Promise<SickCallReasonPolicy> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("org_settings")
    .select("agent_persona")
    .eq("org_id", orgId)
    .maybeSingle();
  return resolveSickCallReasonPolicy((data as { agent_persona?: unknown } | null)?.agent_persona);
}

/* ----------------------------- Day 56 — shift swaps ----------------------- */

function roleNameOf(rc: { name: string } | { name: string }[] | null | undefined): string | null {
  const v = Array.isArray(rc) ? rc[0] : rc;
  return v?.name ?? null;
}

/** A coworker the employee can propose a swap to, with their upcoming shifts (Y options). */
export type ProposableCoworker = {
  id: string;
  name: string;
  shifts: Array<{ id: string; startsAt: string; endsAt: string; roleName: string | null }>;
};

/**
 * Active coworkers (excluding self) + their upcoming published shifts — feeds the
 * "Propose swap" dialog (pick a coworker, optionally pick one of their shifts to trade for).
 */
export async function getProposableCoworkers(
  employeeId: string,
  orgId: string,
): Promise<ProposableCoworker[]> {
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: emps } = await admin
    .from("employees")
    .select("id, name")
    .eq("org_id", orgId)
    .eq("active", true)
    .neq("id", employeeId)
    .order("name", { ascending: true });
  const coworkers = (emps ?? []) as Array<{ id: string; name: string }>;
  if (coworkers.length === 0) return [];

  const { data: shiftRows } = await admin
    .from("shifts")
    .select("id, employee_id, starts_at, ends_at, roles_certifications(name)")
    .eq("org_id", orgId)
    .eq("status", "published")
    .gte("starts_at", nowIso)
    .in(
      "employee_id",
      coworkers.map((c) => c.id),
    )
    .order("starts_at", { ascending: true });

  const byEmp = new Map<string, ProposableCoworker["shifts"]>();
  for (const r of (shiftRows ?? []) as Array<{
    id: string;
    employee_id: string;
    starts_at: string;
    ends_at: string;
    roles_certifications: { name: string } | { name: string }[] | null;
  }>) {
    const list = byEmp.get(r.employee_id) ?? [];
    list.push({
      id: r.id,
      startsAt: r.starts_at,
      endsAt: r.ends_at,
      roleName: roleNameOf(r.roles_certifications),
    });
    byEmp.set(r.employee_id, list);
  }

  return coworkers.map((c) => ({ id: c.id, name: c.name, shifts: byEmp.get(c.id) ?? [] }));
}

/** A swap proposal/offer as shown on the portal. */
export type PortalSwap = {
  requestId: string;
  fromName: string;
  /** The shift on offer (X). */
  shift: { startsAt: string; endsAt: string; roleName: string | null };
  /** The counterpart shift the responder would give up (Y), or null for a handoff/open offer. */
  tradeFor: { startsAt: string; endsAt: string; roleName: string | null } | null;
};

type SwapReqRow = {
  id: string;
  shift_id: string;
  requesting_employee_id: string;
  target_shift_id: string | null;
};

/** Assemble PortalSwap rows from raw swap requests (fetch shift + requester detail). */
async function assembleSwaps(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string,
  rows: SwapReqRow[],
): Promise<PortalSwap[]> {
  if (rows.length === 0) return [];
  const shiftIds = [
    ...new Set(
      rows.flatMap((r) => [r.shift_id, r.target_shift_id]).filter((v): v is string => !!v),
    ),
  ];
  const reqIds = [...new Set(rows.map((r) => r.requesting_employee_id))];

  const [{ data: shiftRows }, { data: empRows }] = await Promise.all([
    admin
      .from("shifts")
      .select("id, starts_at, ends_at, roles_certifications(name)")
      .eq("org_id", orgId)
      .in("id", shiftIds),
    admin.from("employees").select("id, name").eq("org_id", orgId).in("id", reqIds),
  ]);

  const shiftById = new Map(
    (
      (shiftRows ?? []) as Array<{
        id: string;
        starts_at: string;
        ends_at: string;
        roles_certifications: { name: string } | { name: string }[] | null;
      }>
    ).map((s) => [
      s.id,
      { startsAt: s.starts_at, endsAt: s.ends_at, roleName: roleNameOf(s.roles_certifications) },
    ]),
  );
  const nameById = new Map(
    ((empRows ?? []) as Array<{ id: string; name: string }>).map((e) => [e.id, e.name]),
  );

  return rows
    .map((r) => {
      const shift = shiftById.get(r.shift_id);
      if (!shift) return null;
      return {
        requestId: r.id,
        fromName: nameById.get(r.requesting_employee_id) ?? "A coworker",
        shift,
        tradeFor: r.target_shift_id ? (shiftById.get(r.target_shift_id) ?? null) : null,
      } satisfies PortalSwap;
    })
    .filter((s): s is PortalSwap => s !== null);
}

/** Targeted swap proposals awaiting this employee's response. */
export async function getIncomingSwaps(employeeId: string, orgId: string): Promise<PortalSwap[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("shift_swap_requests")
    .select("id, shift_id, requesting_employee_id, target_shift_id")
    .eq("org_id", orgId)
    .eq("target_employee_id", employeeId)
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) {
    logger.error("getIncomingSwaps: query failed", { err: error, employeeId });
    return [];
  }
  return assembleSwaps(admin, orgId, (data ?? []) as SwapReqRow[]);
}

/* ----------------------------- Day 57 — time off -------------------------- */

/** The employee's own time-off requests as shown on the portal. */
export type MyTimeOff = {
  id: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: string;
};

/**
 * Day 57 — the employee's recent + upcoming time-off requests (pending / approved /
 * denied), newest first. Scoped to the session's employee + org via the admin client
 * (auth-light portal, no RLS).
 */
export async function getMyTimeOff(employeeId: string, orgId: string): Promise<MyTimeOff[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("time_off_requests")
    .select("id, start_date, end_date, reason, status")
    .eq("employee_id", employeeId)
    .eq("org_id", orgId)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) {
    logger.error("getMyTimeOff: query failed", { err: error, employeeId });
    return [];
  }
  return (
    (data ?? []) as Array<{
      id: string;
      start_date: string;
      end_date: string;
      reason: string | null;
      status: string;
    }>
  ).map((r) => ({
    id: r.id,
    startDate: r.start_date,
    endDate: r.end_date,
    reason: r.reason,
    status: r.status,
  }));
}

/** Open swap offers this employee could pick up (excluding their own). */
export async function getOpenSwaps(employeeId: string, orgId: string): Promise<PortalSwap[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("shift_swap_requests")
    .select("id, shift_id, requesting_employee_id, target_shift_id")
    .eq("org_id", orgId)
    .is("target_employee_id", null)
    .eq("status", "pending")
    .neq("requesting_employee_id", employeeId)
    .order("created_at", { ascending: true });
  if (error) {
    logger.error("getOpenSwaps: query failed", { err: error, employeeId });
    return [];
  }
  return assembleSwaps(admin, orgId, (data ?? []) as SwapReqRow[]);
}
