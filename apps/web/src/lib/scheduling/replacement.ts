import type { SupabaseClient } from "@supabase/supabase-js";

import { enqueueJob } from "@/lib/jobs/enqueue";
import { createNotification } from "@/lib/notifications/notify";
import { logger } from "@/lib/observability/logger";

import { defaultLaborRules } from "./presets";
import { isAvailable } from "./solver/availability";
import { validateLaborRules } from "./labor-rules";
import type { CoverageSlot } from "./solver/types";
import type { LaborRules, ShiftInput } from "./types";
import type { PermanentRow, TemporaryRow } from "./queries";

/**
 * Day 55 — shift replacement engine (Phase 3G, disruption handling).
 *
 * When a shift goes open (a Day-54 sick-call vacated it, or a manager opened it),
 * this engine finds every eligible employee, broadcasts the open shift to all of
 * them, and lets the FIRST to accept win via the atomic `claim_replacement_offer`
 * RPC. The losers' offers expire in that same transaction; a timeout job escalates
 * to managers on no-fill.
 *
 * This module is PURE (no `import "server-only"`): the admin Supabase client is
 * injected, so the orchestration is unit-testable (mirrors `sick-call.ts` /
 * `createNotification` / `enqueueJob`). The eligibility decision is a separate pure
 * function so it can be tested without any DB. The portal/manager actions wire the
 * real admin client; the timeout/offer jobs reuse `escalateReplacement` from here.
 *
 * Eligibility reuses the existing pure checks wholesale — role match, the Day-44
 * `isAvailable` whitelist, and the Day-42 `validateLaborRules` hard constraints —
 * so the engine never re-implements scheduling rules.
 */

/* ------------------------------ Config ------------------------------------ */

export type ReplacementPolicy = {
  /** Offers expire this many minutes after fan-out (capped at the shift start). */
  timeoutMinutes: number;
  /** Whether a no-fill escalates to managers (always true in v1). */
  escalateToManager: boolean;
};

export const DEFAULT_REPLACEMENT_POLICY: ReplacementPolicy = {
  timeoutMinutes: 120,
  escalateToManager: true,
};

/** Resolve the replacement policy from the org's stored `replacement_policy` jsonb. */
export function resolveReplacementPolicy(value: unknown): ReplacementPolicy {
  const policy = { ...DEFAULT_REPLACEMENT_POLICY };
  if (value && typeof value === "object") {
    const v = value as Record<string, unknown>;
    if (typeof v.timeoutMinutes === "number" && Number.isFinite(v.timeoutMinutes) && v.timeoutMinutes > 0) {
      policy.timeoutMinutes = v.timeoutMinutes;
    }
    if (typeof v.escalateToManager === "boolean") {
      policy.escalateToManager = v.escalateToManager;
    }
  }
  return policy;
}

/* --------------------------- Eligibility (pure) --------------------------- */

/** A candidate employee + the facts the eligibility checks need. */
export type EligibilityCandidate = {
  id: string;
  isMinor: boolean;
  /** Role/cert ids the employee holds, already filtered to those valid for the date. */
  roleIds: string[];
  permanent: PermanentRow[];
  temporary: TemporaryRow[];
  /** The candidate's other assigned (non-cancelled) shifts, for labor + overlap checks. */
  assignedShifts: ShiftInput[];
};

/** The open shift being filled, as the eligibility checks see it. */
export type OpenShift = {
  id: string;
  /** Calendar day (YYYY-MM-DD) of the shift start. */
  date: string;
  startsAt: string;
  endsAt: string;
  roleId: string | null;
  breakMinutes: number;
};

export type FindEligibleInput = {
  shift: OpenShift;
  candidates: EligibilityCandidate[];
  laborRules: LaborRules;
  /** The employee who called out / vacated — never re-offered their own shift. */
  excludeEmployeeId?: string | null;
};

export type EligibilityRejection = { employeeId: string; reason: string };

export type FindEligibleResult = {
  eligible: string[];
  rejected: EligibilityRejection[];
};

/** "Mon Jun 15, 9:00 AM – 5:00 PM" from local-as-UTC ISO strings (UTC accessors). */
function shiftLabel(startsAt: string, endsAt: string): string {
  const fmtDay = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const fmtTime = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
  const s = new Date(Date.parse(startsAt));
  const e = new Date(Date.parse(endsAt));
  return `${fmtDay.format(s)}, ${fmtTime.format(s)} – ${fmtTime.format(e)}`;
}

/** Two shifts overlap iff each starts before the other ends. */
function overlaps(a: ShiftInput, b: ShiftInput): boolean {
  return (
    Date.parse(a.startsAt) < Date.parse(b.endsAt) &&
    Date.parse(b.startsAt) < Date.parse(a.endsAt)
  );
}

/**
 * The eligible subset of `candidates` for the open shift. Pure + deterministic.
 * A candidate is eligible iff: not the caller-out, holds the required role (if any),
 * is available under the whitelist, isn't already booked over the window, and adding
 * the shift introduces no NEW hard labor violation.
 */
export function findEligibleEmployees(input: FindEligibleInput): FindEligibleResult {
  const { shift, candidates, laborRules, excludeEmployeeId } = input;
  const slot: CoverageSlot = {
    id: shift.id,
    date: shift.date,
    startsAt: shift.startsAt,
    endsAt: shift.endsAt,
    roleId: shift.roleId,
    requiredStaff: 1,
    breakMinutes: shift.breakMinutes,
  };

  const eligible: string[] = [];
  const rejected: EligibilityRejection[] = [];

  for (const c of candidates) {
    if (excludeEmployeeId && c.id === excludeEmployeeId) {
      rejected.push({ employeeId: c.id, reason: "called out of this shift" });
      continue;
    }
    if (shift.roleId !== null && !c.roleIds.includes(shift.roleId)) {
      rejected.push({ employeeId: c.id, reason: "not role-qualified" });
      continue;
    }
    if (!isAvailable({ permanent: c.permanent, temporary: c.temporary }, slot)) {
      rejected.push({ employeeId: c.id, reason: "not available" });
      continue;
    }

    const prospective: ShiftInput = {
      id: shift.id,
      employeeId: c.id,
      startsAt: shift.startsAt,
      endsAt: shift.endsAt,
      breakMinutes: shift.breakMinutes,
    };
    if (c.assignedShifts.some((s) => overlaps(s, prospective))) {
      rejected.push({ employeeId: c.id, reason: "already scheduled then" });
      continue;
    }

    const hard = validateLaborRules(
      [...c.assignedShifts, prospective],
      laborRules,
      [{ id: c.id, isMinor: c.isMinor }],
    ).filter((v) => v.severity === "hard" && v.employeeId === c.id);
    if (hard.length > 0) {
      rejected.push({ employeeId: c.id, reason: hard[0].message });
      continue;
    }

    eligible.push(c.id);
  }

  return { eligible, rejected };
}

/* ------------------------------ DB readers -------------------------------- */
/* Raw admin-client reads (the portal is auth-light — RLS does not apply; the
 * caller has already validated the session). Mirrors sick-call.ts's direct reads
 * rather than the server-only query helpers, to keep this module Vitest-importable. */

type ShiftRow = {
  id: string;
  org_id: string;
  schedule_id: string;
  employee_id: string | null;
  role_certification_id: string | null;
  starts_at: string;
  ends_at: string;
  break_minutes: number | null;
  status: string;
};

const num = (v: number | string | null): number => (v === null ? 0 : typeof v === "string" ? Number(v) : v);

/** Window (± a week) of shifts to feed the labor checks around the open shift. */
const LABOR_WINDOW_MS = 8 * 24 * 60 * 60 * 1000;

async function readLaborRules(admin: SupabaseClient, orgId: string): Promise<LaborRules> {
  const { data } = await admin
    .from("labor_rules")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle();
  if (!data) return defaultLaborRules(orgId, new Date(0).toISOString());
  const r = data as Record<string, unknown>;
  return {
    org_id: orgId,
    preset: (r.preset as LaborRules["preset"]) ?? "custom",
    max_daily_hours: num(r.max_daily_hours as number | string),
    max_weekly_hours: num(r.max_weekly_hours as number | string),
    min_rest_hours_between_shifts: num(r.min_rest_hours_between_shifts as number | string),
    overtime_threshold_weekly: num(r.overtime_threshold_weekly as number | string),
    max_consecutive_days: num(r.max_consecutive_days as number | string),
    minor_max_daily_hours:
      r.minor_max_daily_hours === null || r.minor_max_daily_hours === undefined
        ? null
        : num(r.minor_max_daily_hours as number | string),
    minor_earliest_start: (r.minor_earliest_start as string | null) ?? null,
    minor_latest_end: (r.minor_latest_end as string | null) ?? null,
    params: (r.params as Record<string, unknown>) ?? {},
    updated_at: (r.updated_at as string) ?? new Date(0).toISOString(),
  };
}

/** Assemble eligibility candidates: active employees + roles + availability + their
 * assigned shifts in the labor window around the open shift. */
async function readCandidates(
  admin: SupabaseClient,
  orgId: string,
  shift: ShiftRow,
): Promise<EligibilityCandidate[]> {
  const shiftDate = shift.starts_at.slice(0, 10);
  const windowStart = new Date(Date.parse(shift.starts_at) - LABOR_WINDOW_MS).toISOString();
  const windowEnd = new Date(Date.parse(shift.starts_at) + LABOR_WINDOW_MS).toISOString();

  const [empRes, roleRes, availRes, assignedRes] = await Promise.all([
    admin.from("employees").select("id, is_minor").eq("org_id", orgId).eq("active", true),
    admin
      .from("employee_role_assignments")
      .select("employee_id, role_certification_id, expires_at")
      .eq("org_id", orgId),
    admin
      .from("availability")
      .select("id, employee_id, kind, day_of_week, effective_date, end_date, start_time, end_time, is_available")
      .eq("org_id", orgId),
    admin
      .from("shifts")
      .select("id, employee_id, starts_at, ends_at, break_minutes")
      .eq("org_id", orgId)
      .not("employee_id", "is", null)
      .in("status", ["draft", "published"])
      .gte("starts_at", windowStart)
      .lte("starts_at", windowEnd),
  ]);

  for (const [label, res] of [
    ["employees", empRes],
    ["employee_role_assignments", roleRes],
    ["availability", availRes],
    ["assigned_shifts", assignedRes],
  ] as const) {
    if (res.error) logger.warn("replacement.candidate_query_failed", { label, err: res.error, orgId });
  }

  const employees = (empRes.data ?? []) as Array<{ id: string; is_minor: boolean }>;

  const rolesByEmp = new Map<string, string[]>();
  for (const r of (roleRes.data ?? []) as Array<{
    employee_id: string;
    role_certification_id: string;
    expires_at: string | null;
  }>) {
    // Skip lapsed certifications (expired before the shift's calendar day).
    if (r.expires_at !== null && r.expires_at < shiftDate) continue;
    const list = rolesByEmp.get(r.employee_id) ?? [];
    list.push(r.role_certification_id);
    rolesByEmp.set(r.employee_id, list);
  }

  const permByEmp = new Map<string, PermanentRow[]>();
  const tempByEmp = new Map<string, TemporaryRow[]>();
  for (const a of (availRes.data ?? []) as Array<{
    id: string;
    employee_id: string;
    kind: string;
    day_of_week: number | null;
    effective_date: string | null;
    end_date: string | null;
    start_time: string | null;
    end_time: string | null;
    is_available: boolean;
  }>) {
    if (a.kind === "permanent" && a.day_of_week !== null) {
      const list = permByEmp.get(a.employee_id) ?? [];
      list.push({
        id: a.id,
        day_of_week: a.day_of_week,
        is_available: a.is_available,
        start_time: a.start_time,
        end_time: a.end_time,
      });
      permByEmp.set(a.employee_id, list);
    } else if (a.kind === "temporary" && a.effective_date !== null) {
      const list = tempByEmp.get(a.employee_id) ?? [];
      list.push({
        id: a.id,
        effective_date: a.effective_date,
        end_date: a.end_date,
        is_available: a.is_available,
        start_time: a.start_time,
        end_time: a.end_time,
        notes: null,
      });
      tempByEmp.set(a.employee_id, list);
    }
  }

  const assignedByEmp = new Map<string, ShiftInput[]>();
  for (const s of (assignedRes.data ?? []) as Array<{
    id: string;
    employee_id: string;
    starts_at: string;
    ends_at: string;
    break_minutes: number | null;
  }>) {
    if (s.id === shift.id) continue; // never count the open shift itself
    const list = assignedByEmp.get(s.employee_id) ?? [];
    list.push({
      id: s.id,
      employeeId: s.employee_id,
      startsAt: s.starts_at,
      endsAt: s.ends_at,
      breakMinutes: num(s.break_minutes),
    });
    assignedByEmp.set(s.employee_id, list);
  }

  return employees.map((e) => ({
    id: e.id,
    isMinor: e.is_minor,
    roleIds: rolesByEmp.get(e.id) ?? [],
    permanent: permByEmp.get(e.id) ?? [],
    temporary: tempByEmp.get(e.id) ?? [],
    assignedShifts: assignedByEmp.get(e.id) ?? [],
  }));
}

async function readReplacementPolicy(admin: SupabaseClient, orgId: string): Promise<ReplacementPolicy> {
  const { data } = await admin
    .from("org_settings")
    .select("replacement_policy")
    .eq("org_id", orgId)
    .maybeSingle();
  return resolveReplacementPolicy((data as { replacement_policy?: unknown } | null)?.replacement_policy);
}

/* ------------------------------ Orchestration ----------------------------- */

export type OpenReplacementInput = {
  shiftId: string;
  orgId: string;
  /** The originating sick-call, if this open shift came from one. */
  sickCallId?: string | null;
  /** The employee who vacated — excluded from the offer pool. */
  vacatedBy?: string | null;
};

export type OpenReplacementResult =
  | { ok: true; offered: number; status: "offered" | "escalated"; expiresAt: string | null }
  | { ok: false; code: "not_open" | "not_found" | "failed"; message: string };

/**
 * Open the replacement flow for a shift: find the eligible pool, broadcast offers,
 * arm the timeout, and (if nobody's eligible) escalate immediately. The offers +
 * the timeout job are the required writes; the offer-notify enqueue and audit are
 * best-effort (logged, never throw) so a transient failure can't strand the shift.
 */
export async function openReplacement(
  admin: SupabaseClient,
  input: OpenReplacementInput,
): Promise<OpenReplacementResult> {
  const { shiftId, orgId } = input;

  const { data: shiftRaw, error: shiftErr } = await admin
    .from("shifts")
    .select("id, org_id, schedule_id, employee_id, role_certification_id, starts_at, ends_at, break_minutes, status")
    .eq("id", shiftId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (shiftErr) {
    logger.error("replacement.shift_lookup_failed", { err: shiftErr, shiftId, orgId });
    return { ok: false, code: "failed", message: "Couldn't load that shift." };
  }
  const shift = shiftRaw as ShiftRow | null;
  if (!shift) return { ok: false, code: "not_found", message: "Shift not found." };
  // Only an open, future shift can be filled. (Past/cancelled/assigned → nothing to do.)
  if (shift.status !== "open" || shift.employee_id !== null || Date.parse(shift.starts_at) <= Date.now()) {
    return { ok: false, code: "not_open", message: "That shift isn't open for replacement." };
  }

  const [laborRules, candidates, policy] = await Promise.all([
    readLaborRules(admin, orgId),
    readCandidates(admin, orgId, shift),
    readReplacementPolicy(admin, orgId),
  ]);

  const { eligible } = findEligibleEmployees({
    shift: {
      id: shift.id,
      date: shift.starts_at.slice(0, 10),
      startsAt: shift.starts_at,
      endsAt: shift.ends_at,
      roleId: shift.role_certification_id,
      breakMinutes: num(shift.break_minutes),
    },
    candidates,
    laborRules,
    excludeEmployeeId: input.vacatedBy,
  });

  // Nobody can take it → escalate straight to the managers.
  if (eligible.length === 0) {
    await escalateReplacement(admin, {
      shiftId,
      orgId,
      sickCallId: input.sickCallId ?? null,
      reason: "no_eligible",
    });
    return { ok: true, offered: 0, status: "escalated", expiresAt: null };
  }

  // Expire offers at min(now + timeout, shift start) — never offer past the shift.
  const timeoutMs = policy.timeoutMinutes * 60_000;
  const expiresAt = new Date(
    Math.min(Date.now() + timeoutMs, Date.parse(shift.starts_at)),
  ).toISOString();

  const rows = eligible.map((employeeId) => ({
    org_id: orgId,
    shift_id: shiftId,
    sick_call_id: input.sickCallId ?? null,
    employee_id: employeeId,
    status: "offered",
    expires_at: expiresAt,
  }));
  const { error: offerErr } = await admin.from("replacement_pool_events").insert(rows);
  if (offerErr) {
    logger.error("replacement.offer_insert_failed", { err: offerErr, shiftId, orgId });
    return { ok: false, code: "failed", message: "Couldn't create the offers." };
  }

  // Move the sick-call into 'filling' (best-effort).
  if (input.sickCallId) {
    const { error } = await admin
      .from("sick_call_events")
      .update({ status: "filling" })
      .eq("id", input.sickCallId)
      .eq("status", "open");
    if (error) logger.warn("replacement.sick_call_filling_failed", { err: error, sickCallId: input.sickCallId });
  }

  // Arm the timeout/escalation timer (required).
  try {
    await enqueueJob(admin, {
      type: "replacement-offer-timeout",
      payload: { shiftId, orgId, sickCallId: input.sickCallId ?? null },
      runAt: expiresAt,
      orgId,
    });
  } catch (err) {
    logger.error("replacement.timeout_enqueue_failed", { err, shiftId, orgId });
    return { ok: false, code: "failed", message: "Couldn't arm the replacement timer." };
  }

  // Email the offered employees their portal link (best-effort, via the job runtime).
  try {
    await enqueueJob(admin, {
      type: "replacement-offer-notify",
      payload: { shiftId, orgId },
      orgId,
    });
  } catch (err) {
    logger.warn("replacement.notify_enqueue_failed", { err, shiftId, orgId });
  }

  await writeAudit(admin, {
    orgId,
    action: "replacement.offered",
    shiftId,
    detail: { offered: eligible.length, sickCallId: input.sickCallId ?? null, expiresAt },
  });

  return { ok: true, offered: eligible.length, status: "offered", expiresAt };
}

/* ------------------------------ Accept / decline -------------------------- */

export type AcceptOfferResult =
  | { ok: true; outcome: "accepted"; shiftId: string }
  | { ok: false; outcome: "already_filled" | "invalid"; message: string };

/**
 * Claim an offer via the atomic first-accept-wins RPC. On a win, re-arm the Day-53
 * shift-reminder for the new assignee (the shift is published again).
 */
export async function acceptOffer(
  admin: SupabaseClient,
  input: { offerId: string; employeeId: string; orgId: string },
): Promise<AcceptOfferResult> {
  const { data, error } = await admin.rpc("claim_replacement_offer", {
    p_offer_id: input.offerId,
    p_employee_id: input.employeeId,
    p_org_id: input.orgId,
  });
  if (error) {
    logger.error("replacement.claim_failed", { err: error, offerId: input.offerId });
    return { ok: false, outcome: "invalid", message: "Couldn't accept that just now. Please try again." };
  }
  const row = (Array.isArray(data) ? data[0] : data) as
    | { outcome: string; shift_id: string | null }
    | undefined;
  const outcome = row?.outcome ?? "invalid";

  if (outcome === "accepted" && row?.shift_id) {
    await reEnqueueShiftReminder(admin, { shiftId: row.shift_id, employeeId: input.employeeId, orgId: input.orgId });
    return { ok: true, outcome: "accepted", shiftId: row.shift_id };
  }
  if (outcome === "already_filled") {
    return { ok: false, outcome: "already_filled", message: "That shift was just filled by someone else." };
  }
  return { ok: false, outcome: "invalid", message: "That offer is no longer available." };
}

export type DeclineOfferResult = { ok: boolean };

/**
 * Decline an offer. If it was the last outstanding offer on the shift, escalate
 * early rather than waiting for the timeout (best-effort).
 */
export async function declineOffer(
  admin: SupabaseClient,
  input: { offerId: string; employeeId: string; orgId: string },
): Promise<DeclineOfferResult> {
  const { data, error } = await admin
    .from("replacement_pool_events")
    .update({ status: "declined", responded_at: new Date().toISOString() })
    .eq("id", input.offerId)
    .eq("employee_id", input.employeeId)
    .eq("org_id", input.orgId)
    .eq("status", "offered")
    .select("shift_id, sick_call_id")
    .maybeSingle();
  if (error) {
    logger.warn("replacement.decline_failed", { err: error, offerId: input.offerId });
    return { ok: false };
  }
  const declined = data as { shift_id: string; sick_call_id: string | null } | null;
  if (!declined) return { ok: false }; // already responded / not theirs

  // If no offers remain outstanding for the shift, escalate now.
  const { count } = await admin
    .from("replacement_pool_events")
    .select("id", { count: "exact", head: true })
    .eq("shift_id", declined.shift_id)
    .eq("status", "offered");
  if ((count ?? 0) === 0) {
    await escalateReplacement(admin, {
      shiftId: declined.shift_id,
      orgId: input.orgId,
      sickCallId: declined.sick_call_id,
      reason: "all_declined",
    });
  }
  return { ok: true };
}

/* ------------------------------ Escalation -------------------------------- */

export type EscalateReason = "timeout" | "no_eligible" | "all_declined";

export type EscalateResult = { escalated: boolean };

/**
 * Escalate an unfilled open shift to the org's managers. Idempotent: no-ops if the
 * shift is no longer open (already filled / cancelled). Shared by the no-eligible
 * path, the all-declined path, and the timeout job handler.
 */
export async function escalateReplacement(
  admin: SupabaseClient,
  input: { shiftId: string; orgId: string; sickCallId?: string | null; reason: EscalateReason },
): Promise<EscalateResult> {
  const { data: shiftRaw } = await admin
    .from("shifts")
    .select("id, status, employee_id, starts_at, ends_at")
    .eq("id", input.shiftId)
    .eq("org_id", input.orgId)
    .maybeSingle();
  const shift = shiftRaw as
    | { id: string; status: string; employee_id: string | null; starts_at: string; ends_at: string }
    | null;
  if (!shift || shift.status !== "open" || shift.employee_id !== null) {
    return { escalated: false }; // filled or gone — nothing to escalate.
  }

  // Expire any still-outstanding offers.
  const { error: expErr } = await admin
    .from("replacement_pool_events")
    .update({ status: "expired", responded_at: new Date().toISOString() })
    .eq("shift_id", input.shiftId)
    .eq("status", "offered");
  if (expErr) logger.warn("replacement.expire_failed", { err: expErr, shiftId: input.shiftId });

  if (input.sickCallId) {
    const { error } = await admin
      .from("sick_call_events")
      .update({ status: "escalated", resolution: input.reason })
      .eq("id", input.sickCallId)
      .neq("status", "resolved");
    if (error) logger.warn("replacement.sick_call_escalate_failed", { err: error, sickCallId: input.sickCallId });
  }

  const label = shiftLabel(shift.starts_at, shift.ends_at);
  const reasonText =
    input.reason === "no_eligible"
      ? "No eligible employee could take it"
      : input.reason === "all_declined"
        ? "Everyone offered it has declined"
        : "No one accepted it in time";
  await notifyManagers(admin, {
    orgId: input.orgId,
    title: "Open shift needs you",
    body: `${reasonText}. The ${label} shift is still open — please arrange cover.`,
  });

  await writeAudit(admin, {
    orgId: input.orgId,
    action: "replacement.escalated",
    shiftId: input.shiftId,
    detail: { reason: input.reason, sickCallId: input.sickCallId ?? null },
  });

  return { escalated: true };
}

/* ------------------------------ Side effects ------------------------------ */

/** Notify every owner/admin of the org (in-app + email; transactional). Best-effort. */
async function notifyManagers(
  admin: SupabaseClient,
  input: { orgId: string; title: string; body: string },
): Promise<void> {
  const { data, error } = await admin
    .from("memberships")
    .select("user_id")
    .eq("org_id", input.orgId)
    .in("role", ["owner", "admin"]);
  if (error) {
    logger.warn("replacement.manager_lookup_failed", { err: error, orgId: input.orgId });
    return;
  }
  const managerIds = ((data ?? []) as Array<{ user_id: string }>).map((r) => r.user_id);
  for (const userId of managerIds) {
    try {
      await createNotification(admin, {
        orgId: input.orgId,
        userId,
        type: "replacement_escalated",
        title: input.title,
        body: input.body,
        data: { url: "/scheduling", label: "Open scheduling" },
        email: true, // transactional (no pref gate) — managers should know immediately.
      });
    } catch (err) {
      logger.warn("replacement.notify_failed", { err, userId, orgId: input.orgId });
    }
  }
}

/** Re-arm the Day-53 shift-reminder (24h pre-shift) for a freshly-assigned shift. */
async function reEnqueueShiftReminder(
  admin: SupabaseClient,
  input: { shiftId: string; employeeId: string; orgId: string },
): Promise<void> {
  const { data } = await admin
    .from("shifts")
    .select("starts_at")
    .eq("id", input.shiftId)
    .maybeSingle();
  const startsAt = (data as { starts_at: string } | null)?.starts_at;
  if (!startsAt) return;
  const runAt = new Date(Date.parse(startsAt) - 24 * 60 * 60 * 1000);
  if (runAt.getTime() <= Date.now()) return; // shift is within 24h — skip the reminder.
  try {
    await enqueueJob(admin, {
      type: "shift-reminder",
      payload: { shiftId: input.shiftId, employeeId: input.employeeId, orgId: input.orgId },
      runAt,
      orgId: input.orgId,
    });
  } catch (err) {
    logger.warn("replacement.reminder_enqueue_failed", { err, shiftId: input.shiftId });
  }
}

/** Append-only scheduling audit entry. Best-effort. */
async function writeAudit(
  admin: SupabaseClient,
  input: { orgId: string; action: string; shiftId: string; detail: Record<string, unknown> },
): Promise<void> {
  const { error } = await admin.from("scheduling_audit_log").insert({
    org_id: input.orgId,
    actor_type: "system",
    action: input.action,
    entity_type: "shift",
    entity_id: input.shiftId,
    detail: input.detail,
  });
  if (error) logger.warn("replacement.audit_failed", { err: error, action: input.action });
}
