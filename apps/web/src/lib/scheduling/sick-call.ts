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

import { openReplacement } from "./replacement";

/**
 * Day 54 — sick-call / absence handling (Phase 3G, disruption handling).
 *
 * An employee flags "I can't make this shift" from the portal. The agent confirms
 * the shift + (config-gated) reason, the shift is vacated, the managers are
 * notified immediately, and the kind='sick_call' thread is opened so a manager can
 * take it over (Day 58) and the replacement engine (Day 55) can act on it.
 *
 * This module is PURE (no `import "server-only"`): the DeepSeek `chat` seam and the
 * admin Supabase client are injected, so the whole orchestration is unit-testable
 * (mirrors `createNotification`/`enqueueJob`/the structured harnesses). The portal
 * server action wires the real session + admin + DeepSeek deps.
 *
 * Design rule: a sick-call must NEVER be blocked by AI. The confirmation/reason
 * normalization is best-effort — on any DeepSeek failure we fall back to a
 * deterministic confirmation and still process the call-out. The core writes
 * (sick_call_events + vacating the shift) are required; the thread/turns/manager
 * notification/audit writes are best-effort (logged, never throw) so a side-effect
 * failure can't drop a legitimate call-out.
 */

/* ----------------------------- Reason config ------------------------------ */

/**
 * How the portal treats the "why" of a call-out. Stored in
 * `org_settings.agent_persona.sickCallReason` (jsonb — no migration). The manager
 * toggle UI is deferred; the default is `'optional'`.
 *   optional — employee may add a reason (default)
 *   required — employee must provide a reason
 *   hidden   — never ask for a reason (privacy-first orgs)
 */
export type SickCallReasonPolicy = "optional" | "required" | "hidden";

const REASON_POLICIES: readonly SickCallReasonPolicy[] = ["optional", "required", "hidden"];

/** Resolve the reason policy from the org's stored agent_persona jsonb. */
export function resolveSickCallReasonPolicy(agentPersona: unknown): SickCallReasonPolicy {
  if (agentPersona && typeof agentPersona === "object") {
    const v = (agentPersona as Record<string, unknown>).sickCallReason;
    if (typeof v === "string" && (REASON_POLICIES as string[]).includes(v)) {
      return v as SickCallReasonPolicy;
    }
  }
  return "optional";
}

/* --------------------------- Agent confirmation --------------------------- */

/** The structured confirmation the model returns. */
export const sickCallConfirmationSchema = z.object({
  /** A short, neutral normalization of the employee's reason, or null if none/hidden. */
  normalizedReason: z.string().nullable(),
  /** A warm, plain-language confirmation shown back to the employee. */
  confirmationMessage: z.string(),
  /** A coarse bucket for the manager view (best-effort). */
  category: z.enum(["illness", "emergency", "personal", "transport", "other", "unspecified"]),
});

export type SickCallConfirmation = z.infer<typeof sickCallConfirmationSchema>;

export type ConfirmSickCallArgs = {
  employeeName: string;
  /** Human label for the affected shift, e.g. "Mon Jun 15, 9:00 AM – 5:00 PM". */
  shiftLabel: string;
  /** The employee's free-text reason (empty when none / policy hidden). */
  reasonText: string;
  policy: SickCallReasonPolicy;
};

export type ConfirmSickCallDeps = {
  chat: DeepSeekChat;
  model?: string;
  maxRetries?: number;
  onUsage?: (model: string, usage: DeepSeekUsage | null) => void | Promise<void>;
};

function buildSystemPrompt(policy: SickCallReasonPolicy): string {
  return [
    "You are the scheduling assistant for a small business. An employee is telling you",
    "they cannot make an upcoming shift (a sick-call / absence). Acknowledge it warmly",
    "and briefly, in the first person, and reassure them their manager will be told and",
    "a replacement will be sought. Keep `confirmationMessage` to one or two short",
    "sentences. Do not promise a specific outcome or approve anything.",
    "",
    policy === "hidden"
      ? "Do NOT record a reason: set `normalizedReason` to null and `category` to 'unspecified'."
      : [
          "If the employee gives a reason, set `normalizedReason` to a short, neutral",
          "restatement (no editorializing) and pick the best `category`. If they give no",
          "reason, set `normalizedReason` to null and `category` to 'unspecified'.",
        ].join("\n"),
    "Never invent a reason they did not state.",
  ].join("\n");
}

function buildUserContent(args: ConfirmSickCallArgs): string {
  const lines = [`Employee: ${args.employeeName}`, `Shift they can't make: ${args.shiftLabel}`];
  if (args.policy !== "hidden" && args.reasonText.trim()) {
    lines.push(`Reason they gave: ${args.reasonText.trim()}`);
  } else {
    lines.push("Reason they gave: (none)");
  }
  return lines.join("\n");
}

/**
 * Best-effort agent confirmation. Throws `DeepSeekStructuredError` on a model
 * miss after retries — callers wrap this and fall back to `deterministicConfirmation`.
 */
export async function confirmSickCall(
  args: ConfirmSickCallArgs,
  deps: ConfirmSickCallDeps,
): Promise<SickCallConfirmation> {
  const { data } = await generateStructuredDeepSeek({
    chat: deps.chat,
    schema: sickCallConfirmationSchema,
    system: buildSystemPrompt(args.policy),
    userContent: buildUserContent(args),
    model: deps.model ?? SCHEDULING_MODEL,
    toolName: "record_sick_call",
    toolDescription: "Record the confirmation and (if given) the reason for the absence.",
    maxRetries: deps.maxRetries,
    onUsage: deps.onUsage,
  });
  // Honour the privacy policy even if the model slips a reason in.
  if (args.policy === "hidden") {
    return { ...data, normalizedReason: null, category: "unspecified" };
  }
  return data;
}

/** Deterministic confirmation used when AI is unavailable — never blocks a call-out. */
export function deterministicConfirmation(args: ConfirmSickCallArgs): SickCallConfirmation {
  const first = args.employeeName.split(" ")[0] || "there";
  const reason = args.policy !== "hidden" && args.reasonText.trim() ? args.reasonText.trim() : null;
  return {
    normalizedReason: reason,
    confirmationMessage: `Thanks for letting us know, ${first}. We've recorded that you can't make your ${args.shiftLabel} shift and notified your manager — we'll work on finding cover.`,
    category: "unspecified",
  };
}

/** "Sick call — Jane Doe — Mon Jun 15, 9:00 AM – 5:00 PM" */
export function sickCallThreadTitle(employeeName: string, shiftLabel: string): string {
  return `Sick call — ${employeeName} — ${shiftLabel}`;
}

/** "Mon Jun 15, 9:00 AM – 5:00 PM" from local-as-UTC ISO strings (UTC accessors). */
export function shiftLabel(startsAt: string, endsAt: string): string {
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

/* ------------------------------ Orchestration ----------------------------- */

export type ProcessSickCallInput = {
  employeeId: string;
  orgId: string;
  employeeName: string;
  shiftId: string;
  /** Raw free-text reason (ignored when policy is 'hidden'; required when 'required'). */
  reasonText?: string;
};

export type ProcessSickCallDeps = {
  /** DeepSeek chat seam (best-effort). Omit to skip AI and use the deterministic message. */
  chat?: DeepSeekChat;
  model?: string;
  onUsage?: (model: string, usage: DeepSeekUsage | null) => void | Promise<void>;
};

export type ProcessSickCallResult =
  | { ok: true; message: string; sickCallId: string; threadId: string | null }
  | { ok: false; code: "inactive" | "not_found" | "reason_required" | "failed"; message: string };

type ShiftRow = {
  id: string;
  org_id: string;
  employee_id: string | null;
  status: string;
  starts_at: string;
  ends_at: string;
  schedule_id: string;
};

/**
 * Process one sick-call end-to-end. `admin` is the service-role client, scoped in
 * code to the validated portal session's employee + org (the portal is auth-light,
 * so RLS does not apply — identity is the cookie/token).
 */
export async function processSickCall(
  admin: SupabaseClient,
  input: ProcessSickCallInput,
  deps: ProcessSickCallDeps = {},
): Promise<ProcessSickCallResult> {
  const { employeeId, orgId, employeeName, shiftId } = input;

  // 1. The shift must exist, belong to THIS employee + org, and be upcoming.
  const { data: shiftRaw, error: shiftErr } = await admin
    .from("shifts")
    .select("id, org_id, employee_id, status, starts_at, ends_at, schedule_id")
    .eq("id", shiftId)
    .maybeSingle();
  if (shiftErr) {
    logger.error("sick_call.shift_lookup_failed", { err: shiftErr, employeeId, shiftId });
    return {
      ok: false,
      code: "failed",
      message: "Couldn't process that just now. Please try again.",
    };
  }
  const shift = shiftRaw as ShiftRow | null;
  if (
    !shift ||
    shift.org_id !== orgId ||
    shift.employee_id !== employeeId ||
    shift.status === "cancelled" ||
    Date.parse(shift.starts_at) <= Date.now()
  ) {
    return {
      ok: false,
      code: "not_found",
      message:
        "We couldn't find that upcoming shift on your schedule. It may already have changed.",
    };
  }

  // 2. Reason policy.
  const policy = resolveSickCallReasonPolicy(await readAgentPersona(admin, orgId));
  const reasonText = policy === "hidden" ? "" : (input.reasonText ?? "").trim();
  if (policy === "required" && !reasonText) {
    return {
      ok: false,
      code: "reason_required",
      message: "Please add a short reason so your manager has the context.",
    };
  }

  const label = shiftLabel(shift.starts_at, shift.ends_at);

  // 3. Best-effort agent confirmation (never blocks the call-out).
  const confirmArgs: ConfirmSickCallArgs = {
    employeeName,
    shiftLabel: label,
    reasonText,
    policy,
  };
  let confirmation: SickCallConfirmation;
  if (deps.chat) {
    try {
      confirmation = await confirmSickCall(confirmArgs, {
        chat: deps.chat,
        model: deps.model,
        onUsage: deps.onUsage,
      });
    } catch (err) {
      logger.warn("sick_call.confirm_failed_fallback", { err, employeeId });
      confirmation = deterministicConfirmation(confirmArgs);
    }
  } else {
    confirmation = deterministicConfirmation(confirmArgs);
  }

  // 4. Record the call-out (required) — create the event, then vacate the shift.
  const { data: scRaw, error: scErr } = await admin
    .from("sick_call_events")
    .insert({
      org_id: orgId,
      employee_id: employeeId,
      shift_id: shiftId,
      status: "open", // reported; the Day-55 replacement engine moves it to 'filling'.
      notes: confirmation.normalizedReason,
    })
    .select("id")
    .single();
  if (scErr || !scRaw) {
    logger.error("sick_call.insert_failed", { err: scErr, employeeId, shiftId });
    return {
      ok: false,
      code: "failed",
      message: "Couldn't record that just now. Please try again.",
    };
  }
  const sickCallId = (scRaw as { id: string }).id;

  // Vacate the shift: open it up and clear the assignee. This also auto-cancels
  // the Day-53 shift-reminder, which no-ops once status !== 'published' / reassigned.
  const { error: vacateErr } = await admin
    .from("shifts")
    .update({ employee_id: null, status: "open", updated_at: new Date().toISOString() })
    .eq("id", shiftId)
    .eq("employee_id", employeeId); // optimistic guard against a concurrent change
  if (vacateErr) {
    logger.error("sick_call.vacate_failed", { err: vacateErr, employeeId, shiftId, sickCallId });
    // The event is recorded; surface success to the employee but flag for ops.
  }

  // 5. Kick off the Day-55 replacement engine: find eligible staff, broadcast the
  // open shift, arm the timeout. Best-effort — a failure here can't block the
  // call-out (the shift is already vacated; a manager can re-trigger from the UI).
  try {
    await openReplacement(admin, {
      shiftId,
      orgId,
      sickCallId,
      vacatedBy: employeeId,
    });
  } catch (err) {
    logger.warn("sick_call.replacement_open_failed", { err, shiftId, sickCallId });
  }

  // 6. Best-effort side effects: thread (takeover anchor), turns, manager
  // notifications, audit. None of these block the call-out.
  const threadId = await openSickCallThread(admin, {
    orgId,
    employeeName,
    shiftLabel: label,
    reasonText,
    confirmationMessage: confirmation.confirmationMessage,
  });

  await notifyManagers(admin, {
    orgId,
    employeeName,
    shiftLabel: label,
    normalizedReason: confirmation.normalizedReason,
  });

  await writeAudit(admin, {
    orgId,
    actorId: employeeId,
    sickCallId,
    detail: { shiftId, threadId, category: confirmation.category },
  });

  return { ok: true, message: confirmation.confirmationMessage, sickCallId, threadId };
}

/* ------------------------------ Side effects ------------------------------ */

async function readAgentPersona(admin: SupabaseClient, orgId: string): Promise<unknown> {
  const { data } = await admin
    .from("org_settings")
    .select("agent_persona")
    .eq("org_id", orgId)
    .maybeSingle();
  return (data as { agent_persona?: unknown } | null)?.agent_persona ?? null;
}

/** Create the kind='sick_call' thread + log the employee/agent turns. Returns the id or null. */
async function openSickCallThread(
  admin: SupabaseClient,
  input: {
    orgId: string;
    employeeName: string;
    shiftLabel: string;
    reasonText: string;
    confirmationMessage: string;
  },
): Promise<string | null> {
  const { data, error } = await admin
    .from("ai_conversation_threads")
    .insert({
      org_id: input.orgId,
      kind: "sick_call",
      title: sickCallThreadTitle(input.employeeName, input.shiftLabel),
      // mode/status/created_by use their column defaults (ai / open / null).
    })
    .select("id")
    .single();
  if (error || !data) {
    logger.warn("sick_call.thread_create_failed", { err: error, orgId: input.orgId });
    return null;
  }
  const threadId = (data as { id: string }).id;

  const employeeStatement =
    `${input.employeeName} can't make their ${input.shiftLabel} shift.` +
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
      content: [{ type: "text", text: input.confirmationMessage }],
      stop_reason: "end_turn",
    },
  ]);
  if (turnsErr) {
    logger.warn("sick_call.turns_insert_failed", { err: turnsErr, threadId });
  }
  return threadId;
}

/** Notify every owner/admin of the org (in-app + email). Best-effort. */
async function notifyManagers(
  admin: SupabaseClient,
  input: {
    orgId: string;
    employeeName: string;
    shiftLabel: string;
    normalizedReason: string | null;
  },
): Promise<void> {
  const { data, error } = await admin
    .from("memberships")
    .select("user_id")
    .eq("org_id", input.orgId)
    .in("role", ["owner", "admin"]);
  if (error) {
    logger.warn("sick_call.manager_lookup_failed", { err: error, orgId: input.orgId });
    return;
  }
  const managerIds = ((data ?? []) as Array<{ user_id: string }>).map((r) => r.user_id);
  const body =
    `${input.employeeName} can't make their ${input.shiftLabel} shift.` +
    (input.normalizedReason ? ` Reason: ${input.normalizedReason}.` : "") +
    " The shift is now open — review it to arrange cover.";

  // Fan out in parallel: each manager's notification is independent, and the
  // employee reporting the call-out was previously waiting on one insert +
  // email round-trip per manager, in sequence.
  await Promise.all(
    managerIds.map(async (userId) => {
      try {
        await createNotification(admin, {
          orgId: input.orgId,
          userId,
          type: "sick_call",
          title: `${input.employeeName} called out`,
          body,
          data: { url: "/scheduling", label: "Open scheduling" },
          email: true, // transactional (no pref gate) — managers should know immediately.
        });
      } catch (err) {
        logger.warn("sick_call.notify_failed", { err, userId, orgId: input.orgId });
      }
    }),
  );
}

/** Append-only scheduling audit entry for the call-out. Best-effort. */
async function writeAudit(
  admin: SupabaseClient,
  input: { orgId: string; actorId: string; sickCallId: string; detail: Record<string, unknown> },
): Promise<void> {
  const { error } = await admin.from("scheduling_audit_log").insert({
    org_id: input.orgId,
    actor_type: "employee",
    actor_id: input.actorId,
    action: "sick_call.reported",
    entity_type: "sick_call",
    entity_id: input.sickCallId,
    detail: input.detail,
  });
  if (error) {
    logger.warn("sick_call.audit_failed", { err: error, sickCallId: input.sickCallId });
  }
}
