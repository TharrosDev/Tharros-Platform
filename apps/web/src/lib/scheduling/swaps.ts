import type { SupabaseClient } from "@supabase/supabase-js";

import { enqueueJob } from "@/lib/jobs/enqueue";
import { createNotification } from "@/lib/notifications/notify";
import { logger } from "@/lib/observability/logger";

import { findEligibleEmployees, readLaborRules, type EligibilityCandidate } from "./replacement";
import type { ShiftInput } from "./types";
import type { PermanentRow, TemporaryRow } from "./queries";

/**
 * Day 56 — shift swaps (Phase 3G, disruption handling).
 *
 * An employee proposes trading one of their shifts with a coworker (a true two-shift
 * trade X↔Y), handing it off to a specific coworker (X→B), or posting it as an open
 * offer any eligible coworker can pick up. The agent validates role/availability/labor
 * for whoever ends up taking each shift, then — per the org's `swap_policy` — either
 * applies it atomically (`apply_shift_swap` RPC) or escalates to a manager.
 *
 * PURE + DI (no `import "server-only"`): the admin client is injected, so this is
 * unit-testable (mirrors `sick-call.ts` / `replacement.ts`). The eligibility decision
 * (`validateSwap`) reuses the Day-55 `findEligibleEmployees` wholesale — each party is
 * checked as "can this employee take that shift", with the shift they give up removed
 * from their assignments first.
 */

/* ------------------------------ Config ------------------------------------ */

export type SwapPolicy = {
  /** A swap that passes validation applies immediately (else escalates to a manager). */
  autoApproveValid: boolean;
  /** An invalid swap notifies managers (always true in v1). */
  escalateInvalid: boolean;
};

export const DEFAULT_SWAP_POLICY: SwapPolicy = {
  autoApproveValid: true,
  escalateInvalid: true,
};

/** Resolve the swap policy from the org's stored `swap_policy` jsonb. */
export function resolveSwapPolicy(value: unknown): SwapPolicy {
  const policy = { ...DEFAULT_SWAP_POLICY };
  if (value && typeof value === "object") {
    const v = value as Record<string, unknown>;
    if (typeof v.autoApproveValid === "boolean") policy.autoApproveValid = v.autoApproveValid;
    if (typeof v.escalateInvalid === "boolean") policy.escalateInvalid = v.escalateInvalid;
  }
  return policy;
}

/* --------------------------- Validation (pure) ---------------------------- */

/** A shift in a swap, as the eligibility checks see it. */
export type SwapShift = {
  id: string;
  date: string;
  startsAt: string;
  endsAt: string;
  roleId: string | null;
  breakMinutes: number;
};

export type ValidateSwapInput = {
  /** The requester's shift (X) — always given up by the requester, taken by the claimant. */
  shiftX: SwapShift;
  /** The claimant's counterpart shift (Y) in a trade; omit for a handoff / open offer. */
  shiftY?: SwapShift | null;
  /** The requester (A) — gives up X, takes Y (if a trade). */
  requester: EligibilityCandidate;
  /** The claimant (B) — takes X, gives up Y (if a trade). */
  claimant: EligibilityCandidate;
  laborRules: Parameters<typeof findEligibleEmployees>[0]["laborRules"];
};

export type ValidateSwapResult = { valid: boolean; reasons: string[] };

/** Build the "shift to take" + candidate-with-the-given-up-shift-removed, then reuse
 * the Day-55 eligibility filter to decide if `taker` can take `take`. */
function takerEligible(
  take: SwapShift,
  taker: EligibilityCandidate,
  giveUpShiftId: string | null,
  laborRules: ValidateSwapInput["laborRules"],
): { ok: boolean; reason: string | null } {
  const candidate: EligibilityCandidate = {
    ...taker,
    assignedShifts: taker.assignedShifts.filter((s) => s.id !== take.id && s.id !== giveUpShiftId),
  };
  const res = findEligibleEmployees({ shift: take, candidates: [candidate], laborRules });
  if (res.eligible.includes(taker.id)) return { ok: true, reason: null };
  return { ok: false, reason: res.rejected.find((r) => r.employeeId === taker.id)?.reason ?? "not eligible" };
}

/**
 * Whether the post-swap assignment is hard-valid for everyone involved. Pure.
 * - Always: the **claimant** must be able to take **X** (with Y removed if a trade).
 * - Trade only: the **requester** must also be able to take **Y** (with X removed).
 */
export function validateSwap(input: ValidateSwapInput): ValidateSwapResult {
  const reasons: string[] = [];

  const bTakesX = takerEligible(
    input.shiftX,
    input.claimant,
    input.shiftY?.id ?? null,
    input.laborRules,
  );
  if (!bTakesX.ok) reasons.push(`${input.claimant.id} can't take that shift: ${bTakesX.reason}`);

  if (input.shiftY) {
    const aTakesY = takerEligible(input.shiftY, input.requester, input.shiftX.id, input.laborRules);
    if (!aTakesY.ok) reasons.push(`${input.requester.id} can't take the other shift: ${aTakesY.reason}`);
  }

  return { valid: reasons.length === 0, reasons };
}

/* ------------------------------ DB readers -------------------------------- */
/* Raw admin reads (auth-light portal — RLS doesn't apply; the caller validated the
 * session). Mirrors the replacement engine's direct reads. */

const num = (v: number | string | null): number => (v === null ? 0 : typeof v === "string" ? Number(v) : v);
const WINDOW_MS = 8 * 24 * 60 * 60 * 1000;

type ShiftRow = {
  id: string;
  org_id: string;
  employee_id: string | null;
  role_certification_id: string | null;
  starts_at: string;
  ends_at: string;
  break_minutes: number | null;
  status: string;
};

async function readShift(admin: SupabaseClient, orgId: string, shiftId: string): Promise<ShiftRow | null> {
  const { data } = await admin
    .from("shifts")
    .select("id, org_id, employee_id, role_certification_id, starts_at, ends_at, break_minutes, status")
    .eq("id", shiftId)
    .eq("org_id", orgId)
    .maybeSingle();
  return (data as ShiftRow | null) ?? null;
}

function toSwapShift(row: ShiftRow): SwapShift {
  return {
    id: row.id,
    date: row.starts_at.slice(0, 10),
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    roleId: row.role_certification_id,
    breakMinutes: num(row.break_minutes),
  };
}

/** Load one employee as an eligibility candidate (roles + availability + their
 * published shifts in a window spanning the swap's shift dates). */
async function readParty(
  admin: SupabaseClient,
  orgId: string,
  employeeId: string,
  windowStart: string,
  windowEnd: string,
): Promise<EligibilityCandidate | null> {
  const [empRes, roleRes, availRes, shiftsRes] = await Promise.all([
    admin.from("employees").select("id, is_minor, active").eq("id", employeeId).eq("org_id", orgId).maybeSingle(),
    admin
      .from("employee_role_assignments")
      .select("role_certification_id, expires_at")
      .eq("org_id", orgId)
      .eq("employee_id", employeeId),
    admin
      .from("availability")
      .select("id, kind, day_of_week, effective_date, end_date, start_time, end_time, is_available")
      .eq("org_id", orgId)
      .eq("employee_id", employeeId),
    admin
      .from("shifts")
      .select("id, starts_at, ends_at, break_minutes")
      .eq("org_id", orgId)
      .eq("employee_id", employeeId)
      .in("status", ["draft", "published"])
      .gte("starts_at", windowStart)
      .lte("starts_at", windowEnd),
  ]);

  const emp = empRes.data as { id: string; is_minor: boolean; active: boolean } | null;
  if (!emp || !emp.active) return null;

  const today = new Date().toISOString().slice(0, 10);
  const roleIds = ((roleRes.data ?? []) as Array<{ role_certification_id: string; expires_at: string | null }>)
    .filter((r) => r.expires_at === null || r.expires_at >= today)
    .map((r) => r.role_certification_id);

  const permanent: PermanentRow[] = [];
  const temporary: TemporaryRow[] = [];
  for (const a of (availRes.data ?? []) as Array<{
    id: string;
    kind: string;
    day_of_week: number | null;
    effective_date: string | null;
    end_date: string | null;
    start_time: string | null;
    end_time: string | null;
    is_available: boolean;
  }>) {
    if (a.kind === "permanent" && a.day_of_week !== null) {
      permanent.push({
        id: a.id,
        day_of_week: a.day_of_week,
        is_available: a.is_available,
        start_time: a.start_time,
        end_time: a.end_time,
      });
    } else if (a.kind === "temporary" && a.effective_date !== null) {
      temporary.push({
        id: a.id,
        effective_date: a.effective_date,
        end_date: a.end_date,
        is_available: a.is_available,
        start_time: a.start_time,
        end_time: a.end_time,
        notes: null,
      });
    }
  }

  const assignedShifts: ShiftInput[] = ((shiftsRes.data ?? []) as Array<{
    id: string;
    starts_at: string;
    ends_at: string;
    break_minutes: number | null;
  }>).map((s) => ({
    id: s.id,
    employeeId,
    startsAt: s.starts_at,
    endsAt: s.ends_at,
    breakMinutes: num(s.break_minutes),
  }));

  return { id: emp.id, isMinor: emp.is_minor, roleIds, permanent, temporary, assignedShifts };
}

async function readSwapPolicy(admin: SupabaseClient, orgId: string): Promise<SwapPolicy> {
  const { data } = await admin
    .from("org_settings")
    .select("swap_policy")
    .eq("org_id", orgId)
    .maybeSingle();
  return resolveSwapPolicy((data as { swap_policy?: unknown } | null)?.swap_policy);
}

/* ------------------------------ Propose ----------------------------------- */

export type ProposeSwapInput = {
  orgId: string;
  requestingEmployeeId: string;
  /** The requester's shift to swap (X). */
  shiftId: string;
  /** A specific coworker to propose to; omit for an open offer. */
  targetEmployeeId?: string | null;
  /** The coworker's counterpart shift (Y) for a trade; omit for a handoff. */
  targetShiftId?: string | null;
  notes?: string | null;
};

export type ProposeSwapResult =
  | { ok: true; requestId: string }
  | { ok: false; code: "not_found" | "invalid" | "failed"; message: string };

/** Create a swap request. Structural validation only — eligibility is checked when a
 * coworker responds/claims (the world can move in between). */
export async function proposeSwap(
  admin: SupabaseClient,
  input: ProposeSwapInput,
): Promise<ProposeSwapResult> {
  const { orgId, requestingEmployeeId, shiftId } = input;
  const targetEmployeeId = input.targetEmployeeId ?? null;
  const targetShiftId = input.targetShiftId ?? null;

  // An open offer can't name a counterpart shift.
  if (targetEmployeeId === null && targetShiftId !== null) {
    return { ok: false, code: "invalid", message: "An open offer can't include a specific shift to trade." };
  }

  const x = await readShift(admin, orgId, shiftId);
  if (!x || x.employee_id !== requestingEmployeeId || x.status !== "published") {
    return { ok: false, code: "not_found", message: "That shift isn't one of your upcoming published shifts." };
  }
  if (Date.parse(x.starts_at) <= Date.now()) {
    return { ok: false, code: "invalid", message: "That shift has already started." };
  }

  if (targetShiftId !== null) {
    if (targetEmployeeId === null) {
      return { ok: false, code: "invalid", message: "Pick the coworker whose shift you want to trade for." };
    }
    const y = await readShift(admin, orgId, targetShiftId);
    if (!y || y.employee_id !== targetEmployeeId || y.status !== "published" || Date.parse(y.starts_at) <= Date.now()) {
      return { ok: false, code: "invalid", message: "That coworker's shift isn't available to trade." };
    }
  }

  const { data, error } = await admin
    .from("shift_swap_requests")
    .insert({
      org_id: orgId,
      shift_id: shiftId,
      requesting_employee_id: requestingEmployeeId,
      target_employee_id: targetEmployeeId,
      target_shift_id: targetShiftId,
      status: "pending",
      notes: input.notes ?? null,
    })
    .select("id")
    .single();
  if (error || !data) {
    logger.error("swap.propose_insert_failed", { err: error, orgId, shiftId });
    return { ok: false, code: "failed", message: "Couldn't create the swap request. Please try again." };
  }
  const requestId = (data as { id: string }).id;

  await writeAudit(admin, {
    orgId,
    actorId: requestingEmployeeId,
    action: "shift_swap.requested",
    shiftId,
    detail: { requestId, targetEmployeeId, targetShiftId },
  });

  // Targeted → email the coworker; open offer → coworkers see it in their portal.
  if (targetEmployeeId !== null) {
    try {
      await enqueueJob(admin, { type: "swap-proposal-notify", payload: { requestId, orgId }, orgId });
    } catch (err) {
      logger.warn("swap.proposal_notify_enqueue_failed", { err, requestId });
    }
  }

  return { ok: true, requestId };
}

/* ------------------------------ Respond / claim --------------------------- */

type SwapRequestRow = {
  id: string;
  org_id: string;
  shift_id: string;
  requesting_employee_id: string;
  target_employee_id: string | null;
  target_shift_id: string | null;
  status: string;
};

export type SwapDecisionResult =
  | { ok: true; outcome: "applied" | "escalated" | "declined" }
  | { ok: false; code: "not_found" | "invalid" | "stale" | "failed"; message: string };

async function loadRequest(
  admin: SupabaseClient,
  orgId: string,
  requestId: string,
): Promise<SwapRequestRow | null> {
  const { data } = await admin
    .from("shift_swap_requests")
    .select("id, org_id, shift_id, requesting_employee_id, target_employee_id, target_shift_id, status")
    .eq("id", requestId)
    .eq("org_id", orgId)
    .maybeSingle();
  return (data as SwapRequestRow | null) ?? null;
}

/**
 * A coworker accepts a targeted proposal (or claims an open offer). Validates, then
 * per `swap_policy` either applies atomically (first-claim-wins for an open offer via
 * the RPC's row lock) or escalates to a manager. `claimantId` is the responder.
 */
export async function respondToSwap(
  admin: SupabaseClient,
  input: { orgId: string; requestId: string; claimantId: string; accept: boolean },
): Promise<SwapDecisionResult> {
  const req = await loadRequest(admin, input.orgId, input.requestId);
  if (!req) return { ok: false, code: "not_found", message: "That swap request no longer exists." };
  if (req.status !== "pending") return { ok: false, code: "stale", message: "That swap has already been handled." };

  // Targeted proposals can only be answered by their named target; open offers by anyone (not the requester).
  if (req.target_employee_id !== null && req.target_employee_id !== input.claimantId) {
    return { ok: false, code: "invalid", message: "This swap was offered to someone else." };
  }
  if (req.target_employee_id === null && input.claimantId === req.requesting_employee_id) {
    return { ok: false, code: "invalid", message: "You can't pick up your own shift." };
  }

  if (!input.accept) {
    await admin
      .from("shift_swap_requests")
      .update({ status: "denied", reviewed_at: new Date().toISOString() })
      .eq("id", req.id)
      .eq("status", "pending");
    await writeAudit(admin, {
      orgId: input.orgId,
      actorId: input.claimantId,
      action: "shift_swap.declined",
      shiftId: req.shift_id,
      detail: { requestId: req.id },
    });
    notifyResult(admin, input.orgId, req.id, "denied");
    return { ok: true, outcome: "declined" };
  }

  return applyOrEscalate(admin, { req, claimantId: input.claimantId, reviewerUserId: null });
}

/* ------------------------------ Manager review ---------------------------- */

/** Manager approves an escalated swap (status 'accepted'). Re-validates then applies. */
export async function approveSwap(
  admin: SupabaseClient,
  input: { orgId: string; requestId: string; reviewerUserId: string },
): Promise<SwapDecisionResult> {
  const req = await loadRequest(admin, input.orgId, input.requestId);
  if (!req) return { ok: false, code: "not_found", message: "That swap request no longer exists." };
  if (req.status !== "accepted") return { ok: false, code: "stale", message: "That swap isn't awaiting approval." };
  const claimantId = req.target_employee_id;
  if (!claimantId) return { ok: false, code: "invalid", message: "This swap has no claimant to approve." };
  return applyOrEscalate(admin, { req, claimantId, reviewerUserId: input.reviewerUserId, force: true });
}

/** Manager denies an escalated (or pending) swap. */
export async function denySwap(
  admin: SupabaseClient,
  input: { orgId: string; requestId: string; reviewerUserId: string },
): Promise<SwapDecisionResult> {
  const req = await loadRequest(admin, input.orgId, input.requestId);
  if (!req) return { ok: false, code: "not_found", message: "That swap request no longer exists." };
  if (req.status !== "accepted" && req.status !== "pending") {
    return { ok: false, code: "stale", message: "That swap has already been handled." };
  }
  await admin
    .from("shift_swap_requests")
    .update({ status: "denied", reviewed_by: input.reviewerUserId, reviewed_at: new Date().toISOString() })
    .eq("id", req.id);
  await writeAudit(admin, {
    orgId: input.orgId,
    actorId: null,
    actorType: "manager",
    action: "shift_swap.denied",
    shiftId: req.shift_id,
    detail: { requestId: req.id, reviewerUserId: input.reviewerUserId },
  });
  notifyResult(admin, input.orgId, req.id, "denied");
  return { ok: true, outcome: "declined" };
}

/* ------------------------------ Core apply/escalate ----------------------- */

async function applyOrEscalate(
  admin: SupabaseClient,
  args: { req: SwapRequestRow; claimantId: string; reviewerUserId: string | null; force?: boolean },
): Promise<SwapDecisionResult> {
  const { req, claimantId } = args;

  // Load the world for validation.
  const x = await readShift(admin, req.org_id, req.shift_id);
  if (!x || x.employee_id !== req.requesting_employee_id || x.status !== "published") {
    return { ok: false, code: "stale", message: "The shift has changed since this swap was proposed." };
  }
  let y: ShiftRow | null = null;
  if (req.target_shift_id) {
    y = await readShift(admin, req.org_id, req.target_shift_id);
    if (!y || y.employee_id !== claimantId || y.status !== "published") {
      return { ok: false, code: "stale", message: "The other shift has changed since this swap was proposed." };
    }
  }

  const winStart = new Date(
    Math.min(Date.parse(x.starts_at), y ? Date.parse(y.starts_at) : Infinity) - WINDOW_MS,
  ).toISOString();
  const winEnd = new Date(
    Math.max(Date.parse(x.ends_at), y ? Date.parse(y.ends_at) : -Infinity) + WINDOW_MS,
  ).toISOString();

  const [requester, claimant, laborRules, policy] = await Promise.all([
    readParty(admin, req.org_id, req.requesting_employee_id, winStart, winEnd),
    readParty(admin, req.org_id, claimantId, winStart, winEnd),
    readLaborRules(admin, req.org_id),
    readSwapPolicy(admin, req.org_id),
  ]);
  if (!requester || !claimant) {
    return { ok: false, code: "invalid", message: "One of the employees is no longer active." };
  }

  const validation = validateSwap({
    shiftX: toSwapShift(x),
    shiftY: y ? toSwapShift(y) : null,
    requester,
    claimant,
    laborRules,
  });

  // Auto-apply a valid swap when the org allows it. A manager force-approve is an
  // explicit override: it applies regardless of the policy gate or validity (the RPC
  // still guards staleness — ownership + published).
  if (args.force || (validation.valid && policy.autoApproveValid)) {
    const { data, error } = await admin.rpc("apply_shift_swap", {
      p_request_id: req.id,
      p_org_id: req.org_id,
      p_claimant_id: claimantId,
    });
    if (error) {
      logger.error("swap.apply_failed", { err: error, requestId: req.id });
      return { ok: false, code: "failed", message: "Couldn't apply that swap. Please try again." };
    }
    const outcome = (Array.isArray(data) ? data[0]?.outcome : (data as { outcome?: string } | null)?.outcome) ?? "invalid";
    if (outcome !== "applied") {
      return { ok: false, code: "stale", message: "That swap couldn't be applied — a shift changed in the meantime." };
    }

    if (args.reviewerUserId) {
      await admin
        .from("shift_swap_requests")
        .update({ reviewed_by: args.reviewerUserId })
        .eq("id", req.id);
    }
    await reEnqueueReminder(admin, { shiftId: req.shift_id, employeeId: claimantId, orgId: req.org_id });
    if (req.target_shift_id) {
      await reEnqueueReminder(admin, {
        shiftId: req.target_shift_id,
        employeeId: req.requesting_employee_id,
        orgId: req.org_id,
      });
    }
    await writeAudit(admin, {
      orgId: req.org_id,
      actorId: args.reviewerUserId,
      actorType: args.reviewerUserId ? "manager" : "agent",
      action: "shift_swap.approved",
      shiftId: req.shift_id,
      detail: { requestId: req.id, claimantId, auto: !args.reviewerUserId },
    });
    notifyResult(admin, req.org_id, req.id, "approved");
    return { ok: true, outcome: "applied" };
  }

  // Otherwise escalate to the managers (record the claimant so they can approve it).
  await admin
    .from("shift_swap_requests")
    .update({ status: "accepted", target_employee_id: claimantId })
    .eq("id", req.id)
    .eq("status", "pending");
  await escalateToManagers(admin, {
    orgId: req.org_id,
    reason: validation.valid ? "manager approval required" : validation.reasons[0] ?? "swap needs review",
  });
  await writeAudit(admin, {
    orgId: req.org_id,
    actorId: claimantId,
    action: "shift_swap.escalated",
    shiftId: req.shift_id,
    detail: { requestId: req.id, claimantId, valid: validation.valid, reasons: validation.reasons },
  });
  return { ok: true, outcome: "escalated" };
}

/* ------------------------------ Side effects ------------------------------ */

async function escalateToManagers(
  admin: SupabaseClient,
  input: { orgId: string; reason: string },
): Promise<void> {
  const { data, error } = await admin
    .from("memberships")
    .select("user_id")
    .eq("org_id", input.orgId)
    .in("role", ["owner", "admin"]);
  if (error) {
    logger.warn("swap.manager_lookup_failed", { err: error, orgId: input.orgId });
    return;
  }
  for (const { user_id } of (data ?? []) as Array<{ user_id: string }>) {
    try {
      await createNotification(admin, {
        orgId: input.orgId,
        userId: user_id,
        type: "swap_escalated",
        title: "A shift swap needs you",
        body: `An employee shift swap needs review (${input.reason}). Open scheduling to approve or deny it.`,
        data: { url: "/scheduling", label: "Open scheduling" },
        email: true,
      });
    } catch (err) {
      logger.warn("swap.escalate_notify_failed", { err, userId: user_id });
    }
  }
}

/** Fire-and-forget result email to the swap's participants (best-effort). */
function notifyResult(admin: SupabaseClient, orgId: string, requestId: string, result: "approved" | "denied"): void {
  void enqueueJob(admin, { type: "swap-result-notify", payload: { requestId, orgId, result }, orgId }).catch(
    (err) => logger.warn("swap.result_notify_enqueue_failed", { err, requestId }),
  );
}

/** Re-arm the Day-53 shift-reminder for a shift that just changed hands. */
async function reEnqueueReminder(
  admin: SupabaseClient,
  input: { shiftId: string; employeeId: string; orgId: string },
): Promise<void> {
  const { data } = await admin.from("shifts").select("starts_at").eq("id", input.shiftId).maybeSingle();
  const startsAt = (data as { starts_at: string } | null)?.starts_at;
  if (!startsAt) return;
  const runAt = new Date(Date.parse(startsAt) - 24 * 60 * 60 * 1000);
  if (runAt.getTime() <= Date.now()) return;
  try {
    await enqueueJob(admin, {
      type: "shift-reminder",
      payload: { shiftId: input.shiftId, employeeId: input.employeeId, orgId: input.orgId },
      runAt,
      orgId: input.orgId,
    });
  } catch (err) {
    logger.warn("swap.reminder_enqueue_failed", { err, shiftId: input.shiftId });
  }
}

async function writeAudit(
  admin: SupabaseClient,
  input: {
    orgId: string;
    actorId: string | null;
    actorType?: "manager" | "employee" | "agent" | "system";
    action: string;
    shiftId: string;
    detail: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await admin.from("scheduling_audit_log").insert({
    org_id: input.orgId,
    actor_type: input.actorType ?? "employee",
    actor_id: input.actorId,
    action: input.action,
    entity_type: "shift",
    entity_id: input.shiftId,
    detail: input.detail,
  });
  if (error) logger.warn("swap.audit_failed", { err: error, action: input.action });
}
