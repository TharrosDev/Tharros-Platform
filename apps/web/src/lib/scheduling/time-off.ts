import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  generateStructuredDeepSeek,
  type DeepSeekChat,
  type DeepSeekUsage,
} from "@/lib/deepseek/structured";
import { SCHEDULING_MODEL } from "@/lib/deepseek/models";
import { createNotification } from "@/lib/notifications/notify";
import { logger } from "@/lib/observability/logger";

import { findEligibleEmployees, readLaborRules, type EligibilityCandidate } from "./replacement";
import type { ShiftInput } from "./types";
import type { PermanentRow, TemporaryRow } from "./queries";

/**
 * Day 57 — time-off requests (Phase 3G, disruption handling).
 *
 * An employee requests leave (a date range) from the portal. The agent evaluates the
 * STAFFING IMPACT: which of the employee's published shifts fall in the window, and
 * whether each could be covered by an eligible coworker. A deterministic classifier
 * bands the request low/medium/high; per the org's `time_off_policy` a low-impact
 * request auto-approves, everything else lands 'pending' with the agent's
 * recommendation for a manager. Managers retain final authority.
 *
 * PURE + DI (no `import "server-only"`): the admin client + the DeepSeek `chat` seam
 * are injected, so the orchestration is unit-testable (mirrors `sick-call.ts` /
 * `replacement.ts` / `swaps.ts`). The deterministic core decides the band and the
 * outcome; the LLM only DRAFTS the recommendation copy — it never changes the
 * decision (the Day-48 "advisor never changes the outcome" rule). The agent is
 * best-effort: any model failure falls back to a deterministic recommendation and the
 * request is still recorded.
 *
 * Day-57 scope: approval FLAGS the conflicting shifts for the manager — it does NOT
 * auto-vacate them or fire the Day-55 replacement engine. The manager edits the
 * schedule.
 */

/* ------------------------------ Config ------------------------------------ */

export type TimeOffPolicy = {
  /** A low-impact request (no conflicts, or all conflicts coverable) auto-approves. */
  autoApproveLowImpact: boolean;
  /** A high-impact request notifies managers (always true in v1). */
  escalateHighImpact: boolean;
};

export const DEFAULT_TIME_OFF_POLICY: TimeOffPolicy = {
  autoApproveLowImpact: true,
  escalateHighImpact: true,
};

/** Resolve the time-off policy from the org's stored `time_off_policy` jsonb. */
export function resolveTimeOffPolicy(value: unknown): TimeOffPolicy {
  const policy = { ...DEFAULT_TIME_OFF_POLICY };
  if (value && typeof value === "object") {
    const v = value as Record<string, unknown>;
    if (typeof v.autoApproveLowImpact === "boolean")
      policy.autoApproveLowImpact = v.autoApproveLowImpact;
    if (typeof v.escalateHighImpact === "boolean") policy.escalateHighImpact = v.escalateHighImpact;
  }
  return policy;
}

/* --------------------------- Impact classification (pure) ----------------- */

export type ImpactBand = "low" | "medium" | "high";

/** One of the requester's published shifts that falls inside the leave window. */
export type ShiftConflict = {
  shiftId: string;
  startsAt: string;
  endsAt: string;
  /** How many active coworkers could cover this shift (Day-55 eligibility). */
  eligibleCount: number;
};

export type ImpactDetail = {
  conflicts: ShiftConflict[];
  /** Conflicts with zero eligible coverage. */
  uncoverable: number;
};

/**
 * Band the staffing impact of granting the leave. Pure + deterministic.
 *   low    — no conflicting shifts, OR every conflict has an eligible replacement.
 *   high   — there are conflicts and NONE of them can be covered.
 *   medium — there are conflicts, at least one uncoverable but at least one coverable
 *            (partial coverage).
 * Only `low` is eligible for auto-approval; medium/high always reach a manager.
 */
export function classifyImpact(conflicts: ShiftConflict[]): {
  band: ImpactBand;
  detail: ImpactDetail;
} {
  const uncoverable = conflicts.filter((c) => c.eligibleCount === 0).length;
  const detail: ImpactDetail = { conflicts, uncoverable };

  if (conflicts.length === 0 || uncoverable === 0) {
    return { band: "low", detail };
  }
  if (uncoverable === conflicts.length) {
    return { band: "high", detail };
  }
  return { band: "medium", detail };
}

/* --------------------------- Agent recommendation ------------------------- */

/** The structured recommendation the model returns. */
export const timeOffEvaluationSchema = z.object({
  /** A one-line recommendation for the MANAGER (e.g. "Approve — coverage is available."). */
  recommendation: z.string(),
  /** A warm, plain-language acknowledgement shown back to the EMPLOYEE. */
  message: z.string(),
  /** A coarse bucket for the manager view (best-effort). */
  category: z.enum([
    "vacation",
    "appointment",
    "personal",
    "family",
    "medical",
    "other",
    "unspecified",
  ]),
});

export type TimeOffEvaluation = z.infer<typeof timeOffEvaluationSchema>;

export type EvaluateTimeOffArgs = {
  employeeName: string;
  /** Human label for the leave window, e.g. "Jun 15 – Jun 18". */
  rangeLabel: string;
  /** The employee's free-text reason (may be empty). */
  reasonText: string;
  band: ImpactBand;
  conflictCount: number;
  uncoverableCount: number;
  /** Whether the policy will auto-approve this (low impact) — shapes the copy. */
  willAutoApprove: boolean;
};

export type EvaluateTimeOffDeps = {
  chat: DeepSeekChat;
  model?: string;
  maxRetries?: number;
  onUsage?: (model: string, usage: DeepSeekUsage | null) => void | Promise<void>;
};

function buildSystemPrompt(): string {
  return [
    "You are the scheduling assistant for a small business. An employee is requesting",
    "time off (a date range). A deterministic system has ALREADY assessed the staffing",
    "impact and decided the outcome — you do NOT approve or deny anything and you must",
    "not contradict the impact band you are given.",
    "",
    "Return two things:",
    "- `message`: a warm, brief first-person acknowledgement to the EMPLOYEE (one or two",
    "  short sentences). If the request was auto-approved, say it's approved. Otherwise say",
    "  their manager will review it. Never promise an outcome the band doesn't support.",
    "- `recommendation`: a single line for the MANAGER summarizing the staffing impact and",
    "  what you'd suggest (e.g. 'Approve — every affected shift has cover.' or 'Review —",
    "  2 shifts have no available replacement.').",
    "Pick the best `category` from the employee's reason; use 'unspecified' if none is given.",
    "Never invent a reason they did not state.",
  ].join("\n");
}

function buildUserContent(args: EvaluateTimeOffArgs): string {
  const lines = [
    `Employee: ${args.employeeName}`,
    `Requested leave: ${args.rangeLabel}`,
    `Reason they gave: ${args.reasonText.trim() || "(none)"}`,
    `Staffing impact band: ${args.band}`,
    `Shifts affected: ${args.conflictCount} (of which ${args.uncoverableCount} have no available replacement)`,
    `Outcome: ${args.willAutoApprove ? "auto-approved (low impact)" : "pending a manager's decision"}`,
  ];
  return lines.join("\n");
}

/**
 * Best-effort agent recommendation. Throws `DeepSeekStructuredError` on a model miss
 * after retries — callers wrap this and fall back to `deterministicEvaluation`.
 */
export async function evaluateTimeOff(
  args: EvaluateTimeOffArgs,
  deps: EvaluateTimeOffDeps,
): Promise<TimeOffEvaluation> {
  const { data } = await generateStructuredDeepSeek({
    chat: deps.chat,
    schema: timeOffEvaluationSchema,
    system: buildSystemPrompt(),
    userContent: buildUserContent(args),
    model: deps.model ?? SCHEDULING_MODEL,
    toolName: "record_time_off_evaluation",
    toolDescription: "Record the employee acknowledgement and the manager recommendation.",
    maxRetries: deps.maxRetries,
    onUsage: deps.onUsage,
  });
  return data;
}

/** Deterministic recommendation used when AI is unavailable — never blocks a request. */
export function deterministicEvaluation(args: EvaluateTimeOffArgs): TimeOffEvaluation {
  const first = args.employeeName.split(" ")[0] || "there";
  const message = args.willAutoApprove
    ? `Thanks, ${first}. Your time off for ${args.rangeLabel} is approved — it's on your schedule now.`
    : `Thanks, ${first}. We've sent your time-off request for ${args.rangeLabel} to your manager to review.`;
  const recommendation =
    args.conflictCount === 0
      ? "Approve — no scheduled shifts fall in this window."
      : args.uncoverableCount === 0
        ? `Approve — all ${args.conflictCount} affected shift(s) have available cover.`
        : `Review — ${args.uncoverableCount} of ${args.conflictCount} affected shift(s) have no available replacement.`;
  return { recommendation, message, category: "unspecified" };
}

/* ------------------------------ Labels ------------------------------------ */

/** "Jun 15 – Jun 18" (or "Jun 15" for a single day) from YYYY-MM-DD dates. */
export function rangeLabel(startDate: string, endDate: string): string {
  const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const s = fmt.format(new Date(`${startDate}T00:00:00Z`));
  if (startDate === endDate) return s;
  const e = fmt.format(new Date(`${endDate}T00:00:00Z`));
  return `${s} – ${e}`;
}

/** "Time off — Jane Doe — Jun 15 – Jun 18" */
export function timeOffThreadTitle(employeeName: string, range: string): string {
  return `Time off — ${employeeName} — ${range}`;
}

/* ------------------------------ DB readers -------------------------------- */
/* Raw admin reads (auth-light portal — RLS doesn't apply; the caller validated the
 * session). Mirrors the replacement engine's / swaps' direct reads. */

const num = (v: number | string | null): number =>
  v === null ? 0 : typeof v === "string" ? Number(v) : v;
/** Pad the candidate window a week either side of the leave so labor checks see neighbours. */
const WINDOW_MS = 8 * 24 * 60 * 60 * 1000;

type ConflictShiftRow = {
  id: string;
  role_certification_id: string | null;
  starts_at: string;
  ends_at: string;
  break_minutes: number | null;
};

/** The requester's published shifts whose calendar day falls inside [start, end]. */
async function readConflictShifts(
  admin: SupabaseClient,
  orgId: string,
  employeeId: string,
  startDate: string,
  endDate: string,
): Promise<ConflictShiftRow[]> {
  // Half-open upper bound: the day AFTER end_date, so the whole end day is included.
  const upperExclusive = new Date(`${endDate}T00:00:00Z`);
  upperExclusive.setUTCDate(upperExclusive.getUTCDate() + 1);
  const { data, error } = await admin
    .from("shifts")
    .select("id, role_certification_id, starts_at, ends_at, break_minutes")
    .eq("org_id", orgId)
    .eq("employee_id", employeeId)
    .eq("status", "published")
    .gte("starts_at", `${startDate}T00:00:00Z`)
    .lt("starts_at", upperExclusive.toISOString())
    .order("starts_at", { ascending: true });
  if (error) {
    logger.warn("time_off.conflicts_query_failed", { err: error, orgId, employeeId });
    return [];
  }
  return (data ?? []) as ConflictShiftRow[];
}

/** All active coworkers as eligibility candidates over the padded leave window. */
async function readCandidates(
  admin: SupabaseClient,
  orgId: string,
  startDate: string,
  endDate: string,
): Promise<EligibilityCandidate[]> {
  const windowStart = new Date(Date.parse(`${startDate}T00:00:00Z`) - WINDOW_MS).toISOString();
  const windowEnd = new Date(Date.parse(`${endDate}T00:00:00Z`) + WINDOW_MS).toISOString();

  const [empRes, roleRes, availRes, assignedRes] = await Promise.all([
    admin.from("employees").select("id, is_minor").eq("org_id", orgId).eq("active", true),
    admin
      .from("employee_role_assignments")
      .select("employee_id, role_certification_id, expires_at")
      .eq("org_id", orgId),
    admin
      .from("availability")
      .select(
        "id, employee_id, kind, day_of_week, effective_date, end_date, start_time, end_time, is_available",
      )
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
    if (res.error) logger.warn("time_off.candidate_query_failed", { label, err: res.error, orgId });
  }

  const employees = (empRes.data ?? []) as Array<{ id: string; is_minor: boolean }>;
  const today = new Date().toISOString().slice(0, 10);

  const rolesByEmp = new Map<string, string[]>();
  for (const r of (roleRes.data ?? []) as Array<{
    employee_id: string;
    role_certification_id: string;
    expires_at: string | null;
  }>) {
    if (r.expires_at !== null && r.expires_at < today) continue;
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

async function readTimeOffPolicy(admin: SupabaseClient, orgId: string): Promise<TimeOffPolicy> {
  const { data } = await admin
    .from("org_settings")
    .select("time_off_policy")
    .eq("org_id", orgId)
    .maybeSingle();
  return resolveTimeOffPolicy((data as { time_off_policy?: unknown } | null)?.time_off_policy);
}

/**
 * Compute the staffing impact: the requester's conflicting shifts + how many coworkers
 * could cover each (the Day-55 eligibility filter, with the requester excluded).
 */
export async function assessImpact(
  admin: SupabaseClient,
  input: { orgId: string; employeeId: string; startDate: string; endDate: string },
): Promise<{ band: ImpactBand; detail: ImpactDetail }> {
  const { orgId, employeeId, startDate, endDate } = input;
  const [shifts, candidates, laborRules] = await Promise.all([
    readConflictShifts(admin, orgId, employeeId, startDate, endDate),
    readCandidates(admin, orgId, startDate, endDate),
    readLaborRules(admin, orgId),
  ]);

  const conflicts: ShiftConflict[] = shifts.map((s) => {
    const { eligible } = findEligibleEmployees({
      shift: {
        id: s.id,
        date: s.starts_at.slice(0, 10),
        startsAt: s.starts_at,
        endsAt: s.ends_at,
        roleId: s.role_certification_id,
        breakMinutes: num(s.break_minutes),
      },
      candidates,
      laborRules,
      excludeEmployeeId: employeeId, // never count the requester as their own cover
    });
    return {
      shiftId: s.id,
      startsAt: s.starts_at,
      endsAt: s.ends_at,
      eligibleCount: eligible.length,
    };
  });

  return classifyImpact(conflicts);
}

/* ------------------------------ Orchestration ----------------------------- */

export type ProcessTimeOffInput = {
  employeeId: string;
  orgId: string;
  employeeName: string;
  /** YYYY-MM-DD (inclusive). */
  startDate: string;
  endDate: string;
  reasonText?: string;
};

export type ProcessTimeOffDeps = {
  /** DeepSeek chat seam (best-effort). Omit to skip AI and use the deterministic copy. */
  chat?: DeepSeekChat;
  model?: string;
  onUsage?: (model: string, usage: DeepSeekUsage | null) => void | Promise<void>;
};

export type ProcessTimeOffResult =
  | {
      ok: true;
      message: string;
      requestId: string;
      status: "approved" | "pending";
      band: ImpactBand;
    }
  | { ok: false; code: "inactive" | "invalid_dates" | "failed"; message: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Process one time-off request end-to-end. `admin` is the service-role client, scoped
 * in code to the validated portal session's employee + org (the portal is auth-light,
 * so RLS does not apply — identity is the cookie/token). The request insert is the
 * required write; the thread/turns/manager-notification/audit are best-effort (logged,
 * never throw) so a side-effect failure can't drop a legitimate request.
 */
export async function processTimeOffRequest(
  admin: SupabaseClient,
  input: ProcessTimeOffInput,
  deps: ProcessTimeOffDeps = {},
): Promise<ProcessTimeOffResult> {
  const { employeeId, orgId, employeeName, startDate, endDate } = input;

  // 1. Validate the date range.
  if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate) || endDate < startDate) {
    return { ok: false, code: "invalid_dates", message: "Pick a valid start and end date." };
  }
  const todayUtc = new Date().toISOString().slice(0, 10);
  if (startDate < todayUtc) {
    return {
      ok: false,
      code: "invalid_dates",
      message: "Time off can only be requested for future dates.",
    };
  }

  // 2. The employee must still be active.
  const { data: empRaw, error: empErr } = await admin
    .from("employees")
    .select("id, active")
    .eq("id", employeeId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (empErr) {
    logger.error("time_off.employee_lookup_failed", { err: empErr, employeeId });
    return {
      ok: false,
      code: "failed",
      message: "Couldn't process that just now. Please try again.",
    };
  }
  const emp = empRaw as { id: string; active: boolean } | null;
  if (!emp || !emp.active) {
    return {
      ok: false,
      code: "inactive",
      message: "This link isn't active anymore. Ask your manager for a fresh one.",
    };
  }

  // 3. Assess the staffing impact + read the policy.
  const [{ band, detail }, policy] = await Promise.all([
    assessImpact(admin, { orgId, employeeId, startDate, endDate }),
    readTimeOffPolicy(admin, orgId),
  ]);

  const willAutoApprove = band === "low" && policy.autoApproveLowImpact;
  const status: "approved" | "pending" = willAutoApprove ? "approved" : "pending";
  const label = rangeLabel(startDate, endDate);
  const reasonText = (input.reasonText ?? "").trim();

  // 4. Best-effort agent recommendation (never blocks the request).
  const evalArgs: EvaluateTimeOffArgs = {
    employeeName,
    rangeLabel: label,
    reasonText,
    band,
    conflictCount: detail.conflicts.length,
    uncoverableCount: detail.uncoverable,
    willAutoApprove,
  };
  let evaluation: TimeOffEvaluation;
  if (deps.chat) {
    try {
      evaluation = await evaluateTimeOff(evalArgs, {
        chat: deps.chat,
        model: deps.model,
        onUsage: deps.onUsage,
      });
    } catch (err) {
      logger.warn("time_off.evaluate_failed_fallback", { err, employeeId });
      evaluation = deterministicEvaluation(evalArgs);
    }
  } else {
    evaluation = deterministicEvaluation(evalArgs);
  }

  // 5. Record the request (required).
  const nowIso = new Date().toISOString();
  const { data: reqRaw, error: reqErr } = await admin
    .from("time_off_requests")
    .insert({
      org_id: orgId,
      employee_id: employeeId,
      start_date: startDate,
      end_date: endDate,
      reason: reasonText || null,
      status,
      impact_band: band,
      impact_detail: detail,
      recommendation: evaluation.recommendation,
      auto_decided: willAutoApprove,
      reviewed_at: willAutoApprove ? nowIso : null,
    })
    .select("id")
    .single();
  if (reqErr || !reqRaw) {
    logger.error("time_off.insert_failed", { err: reqErr, employeeId });
    return {
      ok: false,
      code: "failed",
      message: "Couldn't record that just now. Please try again.",
    };
  }
  const requestId = (reqRaw as { id: string }).id;

  // 6. Best-effort side effects: takeover thread, manager notification, audit.
  const threadId = await openTimeOffThread(admin, {
    orgId,
    employeeName,
    rangeLabel: label,
    reasonText,
    message: evaluation.message,
    recommendation: evaluation.recommendation,
  });
  if (threadId) {
    await admin.from("time_off_requests").update({ thread_id: threadId }).eq("id", requestId);
  }

  await notifyManagers(admin, {
    orgId,
    employeeName,
    rangeLabel: label,
    band,
    autoApproved: willAutoApprove,
    recommendation: evaluation.recommendation,
  });

  await writeAudit(admin, {
    orgId,
    actorId: employeeId,
    actorType: "employee",
    action: "time_off.requested",
    requestId,
    detail: {
      startDate,
      endDate,
      band,
      autoApproved: willAutoApprove,
      category: evaluation.category,
      threadId,
    },
  });

  return { ok: true, message: evaluation.message, requestId, status, band };
}

/* ------------------------------ Manager review ---------------------------- */

type TimeOffRow = {
  id: string;
  org_id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  status: string;
};

export type TimeOffDecisionResult =
  | { ok: true; outcome: "approved" | "denied" }
  | { ok: false; code: "not_found" | "stale" | "failed"; message: string };

async function loadRequest(
  admin: SupabaseClient,
  orgId: string,
  requestId: string,
): Promise<TimeOffRow | null> {
  const { data } = await admin
    .from("time_off_requests")
    .select("id, org_id, employee_id, start_date, end_date, status")
    .eq("id", requestId)
    .eq("org_id", orgId)
    .maybeSingle();
  return (data as TimeOffRow | null) ?? null;
}

/** Manager approves a pending request. */
export async function approveTimeOff(
  admin: SupabaseClient,
  input: { orgId: string; requestId: string; reviewerUserId: string },
): Promise<TimeOffDecisionResult> {
  const req = await loadRequest(admin, input.orgId, input.requestId);
  if (!req) return { ok: false, code: "not_found", message: "That request no longer exists." };
  if (req.status !== "pending")
    return { ok: false, code: "stale", message: "That request has already been handled." };
  return decide(admin, { req, reviewerUserId: input.reviewerUserId, to: "approved" });
}

/** Manager denies a pending request. */
export async function denyTimeOff(
  admin: SupabaseClient,
  input: { orgId: string; requestId: string; reviewerUserId: string },
): Promise<TimeOffDecisionResult> {
  const req = await loadRequest(admin, input.orgId, input.requestId);
  if (!req) return { ok: false, code: "not_found", message: "That request no longer exists." };
  if (req.status !== "pending")
    return { ok: false, code: "stale", message: "That request has already been handled." };
  return decide(admin, { req, reviewerUserId: input.reviewerUserId, to: "denied" });
}

/**
 * Manager reverses an already-approved request (including an auto-approval) back to
 * denied — the affordance for "the agent auto-approved this but I need them on shift".
 */
export async function reverseTimeOff(
  admin: SupabaseClient,
  input: { orgId: string; requestId: string; reviewerUserId: string },
): Promise<TimeOffDecisionResult> {
  const req = await loadRequest(admin, input.orgId, input.requestId);
  if (!req) return { ok: false, code: "not_found", message: "That request no longer exists." };
  if (req.status !== "approved")
    return { ok: false, code: "stale", message: "Only an approved request can be reversed." };
  return decide(admin, { req, reviewerUserId: input.reviewerUserId, to: "denied", reversed: true });
}

async function decide(
  admin: SupabaseClient,
  args: { req: TimeOffRow; reviewerUserId: string; to: "approved" | "denied"; reversed?: boolean },
): Promise<TimeOffDecisionResult> {
  const { req, reviewerUserId, to } = args;
  const { error } = await admin
    .from("time_off_requests")
    .update({
      status: to,
      reviewed_by: reviewerUserId,
      reviewed_at: new Date().toISOString(),
      auto_decided: false,
    })
    .eq("id", req.id)
    .eq("org_id", req.org_id);
  if (error) {
    logger.error("time_off.decide_failed", { err: error, requestId: req.id, to });
    return {
      ok: false,
      code: "failed",
      message: "Couldn't update that request. Please try again.",
    };
  }
  await writeAudit(admin, {
    orgId: req.org_id,
    actorId: reviewerUserId,
    actorType: "manager",
    action: args.reversed ? "time_off.reversed" : `time_off.${to}`,
    requestId: req.id,
    detail: { employeeId: req.employee_id, startDate: req.start_date, endDate: req.end_date },
  });
  return { ok: true, outcome: to };
}

/* ------------------------------ Manager pane data ------------------------- */

export type PendingTimeOff = {
  id: string;
  employeeId: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: string;
  impactBand: ImpactBand | null;
  recommendation: string | null;
  autoDecided: boolean;
  createdAt: string;
};

/**
 * Requests for the manager pane: everything pending, plus recently decided ones (so the
 * manager can see / reverse an auto-approval). Joined to the employee name.
 */
export async function getPendingTimeOff(
  admin: SupabaseClient,
  orgId: string,
): Promise<PendingTimeOff[]> {
  const { data, error } = await admin
    .from("time_off_requests")
    .select(
      "id, employee_id, start_date, end_date, reason, status, impact_band, recommendation, auto_decided, created_at, employees(name)",
    )
    .eq("org_id", orgId)
    .in("status", ["pending", "approved"])
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    logger.warn("time_off.pending_query_failed", { err: error, orgId });
    return [];
  }
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    employeeId: r.employee_id as string,
    employeeName: ((r.employees as { name?: string } | null)?.name ?? "An employee") as string,
    startDate: r.start_date as string,
    endDate: r.end_date as string,
    reason: (r.reason as string | null) ?? null,
    status: r.status as string,
    impactBand: (r.impact_band as ImpactBand | null) ?? null,
    recommendation: (r.recommendation as string | null) ?? null,
    autoDecided: Boolean(r.auto_decided),
    createdAt: r.created_at as string,
  }));
}

/* ------------------------------ Side effects ------------------------------ */

/** Create the kind='time_off' thread + log the employee/agent turns. Returns the id or null. */
async function openTimeOffThread(
  admin: SupabaseClient,
  input: {
    orgId: string;
    employeeName: string;
    rangeLabel: string;
    reasonText: string;
    message: string;
    recommendation: string;
  },
): Promise<string | null> {
  const { data, error } = await admin
    .from("ai_conversation_threads")
    .insert({
      org_id: input.orgId,
      kind: "time_off",
      title: timeOffThreadTitle(input.employeeName, input.rangeLabel),
      // mode/status/created_by use their column defaults (ai / open / null).
    })
    .select("id")
    .single();
  if (error || !data) {
    logger.warn("time_off.thread_create_failed", { err: error, orgId: input.orgId });
    return null;
  }
  const threadId = (data as { id: string }).id;

  const employeeStatement =
    `${input.employeeName} requested time off for ${input.rangeLabel}.` +
    (input.reasonText ? ` Reason: ${input.reasonText}` : "");
  const { error: turnsErr } = await admin.from("agent_turns").insert([
    {
      thread_id: threadId,
      org_id: input.orgId,
      role: "user",
      content: [{ type: "text", text: employeeStatement }],
    },
    {
      thread_id: threadId,
      org_id: input.orgId,
      role: "assistant",
      content: [
        { type: "text", text: `${input.message}\n\nManager note: ${input.recommendation}` },
      ],
      stop_reason: "end_turn",
    },
  ]);
  if (turnsErr) {
    logger.warn("time_off.turns_insert_failed", { err: turnsErr, threadId });
  }
  return threadId;
}

/** Notify every owner/admin of the org (in-app + email). Best-effort. */
async function notifyManagers(
  admin: SupabaseClient,
  input: {
    orgId: string;
    employeeName: string;
    rangeLabel: string;
    band: ImpactBand;
    autoApproved: boolean;
    recommendation: string;
  },
): Promise<void> {
  const { data, error } = await admin
    .from("memberships")
    .select("user_id")
    .eq("org_id", input.orgId)
    .in("role", ["owner", "admin"]);
  if (error) {
    logger.warn("time_off.manager_lookup_failed", { err: error, orgId: input.orgId });
    return;
  }
  const managerIds = ((data ?? []) as Array<{ user_id: string }>).map((r) => r.user_id);
  const title = input.autoApproved
    ? `${input.employeeName}'s time off was auto-approved`
    : `${input.employeeName} requested time off`;
  const body = input.autoApproved
    ? `${input.employeeName}'s time off for ${input.rangeLabel} was auto-approved (low staffing impact). ${input.recommendation} You can reverse it from scheduling if needed.`
    : `${input.employeeName} requested time off for ${input.rangeLabel} (${input.band} impact). ${input.recommendation} Open scheduling to approve or deny it.`;

  for (const userId of managerIds) {
    try {
      await createNotification(admin, {
        orgId: input.orgId,
        userId,
        type: "time_off_requested",
        title,
        body,
        data: { url: "/scheduling", label: "Open scheduling" },
        email: true, // transactional (no pref gate) — managers should know.
      });
    } catch (err) {
      logger.warn("time_off.notify_failed", { err, userId, orgId: input.orgId });
    }
  }
}

/** Append-only scheduling audit entry. Best-effort. */
async function writeAudit(
  admin: SupabaseClient,
  input: {
    orgId: string;
    actorId: string | null;
    actorType: "manager" | "employee" | "agent" | "system";
    action: string;
    requestId: string;
    detail: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await admin.from("scheduling_audit_log").insert({
    org_id: input.orgId,
    actor_type: input.actorType,
    actor_id: input.actorId,
    action: input.action,
    entity_type: "time_off",
    entity_id: input.requestId,
    detail: input.detail,
  });
  if (error) logger.warn("time_off.audit_failed", { err: error, action: input.action });
}
