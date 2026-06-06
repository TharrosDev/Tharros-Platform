"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/observability/logger";
import { recordUsage } from "@/lib/billing/usage";
import { chatCompletion } from "@/lib/deepseek/client";
import { SCHEDULING_MODEL } from "@/lib/deepseek/models";
import { mapDeepSeekUsage } from "@/lib/deepseek/usage";

import { getPortalSession } from "./session";
import {
  parseAvailabilityText,
  parsedAvailabilitySchema,
  type ParsedAvailability,
} from "@/lib/scheduling/availability-parse";

/**
 * Day 45 — employee-portal availability collection. The employee is auth-light
 * (no Supabase account), so the manager-side RLS write path does NOT apply. These
 * actions establish identity from the validated portal session, then write with
 * the service-role admin client strictly scoped to that session's employee + org —
 * the cookie/token is the sole authority (mirrors how system writes use admin).
 *
 * `submitAvailabilityText` parses plain language → structured preview (NOT saved),
 * driving the confirm/correct loop. `savePortalAvailability` persists the
 * confirmed parse. The parse runs on DeepSeek (the scheduling provider) and meters
 * into the Day-33 `ai_usage_events` like every other AI call.
 */

const INACTIVE = "This link isn't active anymore. Ask your manager for a fresh one.";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export type PortalAvailabilityState = {
  status: "idle" | "preview" | "error";
  parsed?: ParsedAvailability;
  /** The text the employee typed, kept so the textarea + corrections persist. */
  sourceText?: string;
  message?: string;
};

/** Parse the typed availability into a preview. Does not save. */
export async function submitAvailabilityText(
  _prev: PortalAvailabilityState,
  formData: FormData,
): Promise<PortalAvailabilityState> {
  const session = await getPortalSession();
  if (!session) return { status: "error", message: INACTIVE };

  const text = String(formData.get("text") ?? "").trim();
  if (!text) {
    return { status: "error", message: "Tell us when you can work, in your own words." };
  }

  // A prior parse (when correcting) is fed back so the model returns the full set.
  let priorParse: ParsedAvailability | undefined;
  const priorRaw = formData.get("prior");
  if (typeof priorRaw === "string" && priorRaw.length > 0) {
    try {
      const p = parsedAvailabilitySchema.safeParse(JSON.parse(priorRaw));
      if (p.success) priorParse = p.data;
    } catch {
      // Ignore a malformed prior — treat as a fresh parse.
    }
  }

  try {
    const parsed = await parseAvailabilityText(
      { text, today: today(), priorParse },
      {
        chat: chatCompletion,
        model: SCHEDULING_MODEL,
        onUsage: (model, usage) => recordUsage(session.orgId, null, model, mapDeepSeekUsage(usage)),
      },
    );
    return { status: "preview", parsed, sourceText: text };
  } catch (err) {
    logger.error("portal.availability_parse_failed", { err, employeeId: session.employeeId });
    return {
      status: "error",
      message:
        "Sorry, I couldn't read that. Try rephrasing, for example “Mon to Fri 9 to 5, off June 20 to 25”.",
      sourceText: text,
    };
  }
}

export type SaveAvailabilityResult = { ok: boolean; message: string };

/**
 * Persist the confirmed parse. Treats it as the FULL current picture: replaces
 * the permanent weekly grid and the employee's future-dated temporary overrides,
 * then inserts the confirmed set. Scoped to the session employee + org only.
 */
export async function savePortalAvailability(
  parsed: ParsedAvailability,
): Promise<SaveAvailabilityResult> {
  const session = await getPortalSession();
  if (!session) return { ok: false, message: INACTIVE };

  const valid = parsedAvailabilitySchema.safeParse(parsed);
  if (!valid.success) {
    return { ok: false, message: "Something looked off — please try entering that again." };
  }

  const admin = createAdminClient();
  const { employeeId, orgId } = session;
  const nullable = (v: string | undefined) => (v && v.length > 0 ? v : null);

  // Replace permanent rows (whitelist: only workable days are stored).
  const delPerm = await admin
    .from("availability")
    .delete()
    .eq("employee_id", employeeId)
    .eq("kind", "permanent");
  if (delPerm.error) {
    logger.error("portal.availability_save_failed", {
      step: "del_perm",
      err: delPerm.error,
      employeeId,
    });
    return { ok: false, message: "Couldn't save just now. Please try again." };
  }

  const workable = valid.data.permanent.filter((d) => d.is_available);
  if (workable.length > 0) {
    const insPerm = await admin.from("availability").insert(
      workable.map((d) => ({
        org_id: orgId,
        employee_id: employeeId,
        kind: "permanent",
        day_of_week: d.day_of_week,
        is_available: true,
        start_time: nullable(d.start_time),
        end_time: nullable(d.end_time),
      })),
    );
    if (insPerm.error) {
      logger.error("portal.availability_save_failed", {
        step: "ins_perm",
        err: insPerm.error,
        employeeId,
      });
      return { ok: false, message: "Couldn't save just now. Please try again." };
    }
  }

  // Replace future-dated temporary overrides (preserve historical ones).
  const delTemp = await admin
    .from("availability")
    .delete()
    .eq("employee_id", employeeId)
    .eq("kind", "temporary")
    .gte("effective_date", today());
  if (delTemp.error) {
    logger.error("portal.availability_save_failed", {
      step: "del_temp",
      err: delTemp.error,
      employeeId,
    });
    return { ok: false, message: "Couldn't save just now. Please try again." };
  }

  const upcoming = valid.data.temporary.filter((t) => (t.end_date || t.effective_date) >= today());
  if (upcoming.length > 0) {
    const insTemp = await admin.from("availability").insert(
      upcoming.map((t) => ({
        org_id: orgId,
        employee_id: employeeId,
        kind: "temporary",
        effective_date: t.effective_date,
        end_date: nullable(t.end_date),
        is_available: t.is_available,
        start_time: nullable(t.start_time),
        end_time: nullable(t.end_time),
        notes: t.notes && t.notes.length > 0 ? t.notes : null,
      })),
    );
    if (insTemp.error) {
      logger.error("portal.availability_save_failed", {
        step: "ins_temp",
        err: insTemp.error,
        employeeId,
      });
      return { ok: false, message: "Couldn't save just now. Please try again." };
    }
  }

  return { ok: true, message: "Thanks, your availability is saved." };
}
