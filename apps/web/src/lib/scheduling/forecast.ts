import { z } from "zod";

import {
  generateStructuredDeepSeek,
  type DeepSeekChat,
  type DeepSeekUsage,
} from "@/lib/deepseek/structured";
import { SCHEDULING_MODEL_PRO } from "@/lib/deepseek/models";

import { staffingDaySchema, type StaffingDay } from "./schemas";

/**
 * Day 47 — demand-forecasting agent. Proposes **soft** staffing levels (per
 * weekday window + role) the schedule should aim to cover. There's no historical
 * shift/sales data yet, so it reasons from the business context the org already
 * has: operating hours, roster size/roles/employment mix, the manual staffing
 * baseline (Day 43), and the business persona/notes. Output feeds
 * `staffing_requirements` with `source='forecast'` — the manager confirms; the
 * Day-46 solver treats them as soft coverage targets.
 *
 * Pure + provider-free (the DeepSeek `chat` seam is injected), mirroring the
 * Day-45 availability parser. Runs on the stronger `deepseek-v4-pro` tier
 * (quality-critical, reserved for the Day 47–49 agent steps).
 */

/** The structured forecast: suggested coverage rows + a plain-language summary. */
export const forecastStaffingSchema = z.object({
  /** Suggested coverage: same shape as the Day-43 manual staffing rows. */
  requirements: z.array(staffingDaySchema).max(60),
  /** A short restatement of the reasoning, shown to the manager to confirm. */
  summary: z.string(),
});

export type ForecastStaffing = z.infer<typeof forecastStaffingSchema>;

/** The business context the forecast reasons from (assembled by the caller). */
export type ForecastContext = {
  businessHours: Array<{
    day_of_week: number;
    opens_at: string | null;
    closes_at: string | null;
    is_closed: boolean;
  }>;
  roster: {
    count: number;
    /** Role/certification names available in the org. */
    roles: string[];
    /** Headcount by employment type, e.g. { full_time: 2, part_time: 5 }. */
    employmentMix: Record<string, number>;
  };
  /** Existing `source='manual'` staffing rows — refine these, don't ignore them. */
  manualBaseline: Array<{
    day_of_week: number | null;
    start_time: string;
    end_time: string;
    min_staff: number;
    role: string | null;
  }>;
  persona: { tone: string; notes: string };
};

export type ForecastStaffingArgs = {
  context: ForecastContext;
  /** Today's date (YYYY-MM-DD), for any relative reasoning. */
  today: string;
};

export type ForecastStaffingDeps = {
  chat: DeepSeekChat;
  model?: string;
  maxRetries?: number;
  /** Metering seam — receives each model call's usage. */
  onUsage?: (model: string, usage: DeepSeekUsage | null) => void | Promise<void>;
};

const WEEKDAY_LEGEND = "0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday";

function buildSystemPrompt(roles: string[]): string {
  return [
    "You are a staffing demand planner. Propose how many people are needed in which",
    "time windows so a manager can build a schedule. Output SOFT suggestions, not a schedule.",
    "",
    "Reason ONLY from the business context provided:",
    "- business hours: only suggest coverage inside open hours; never on a closed day.",
    "- roster size + employment mix: don't suggest more staff than the org could plausibly field.",
    "- the manual baseline: treat it as the manager's intent — refine/extend it, don't discard it.",
    "- the persona/notes: use stated busy periods (e.g. weekend rushes) to shape peaks.",
    "",
    `Each requirement: weekday (${WEEKDAY_LEGEND}), start_time and end_time as 24-hour 'HH:MM',`,
    "min_staff (a positive integer), and an optional role.",
    roles.length > 0
      ? `Use a role ONLY from this list, copied verbatim: ${roles.join(", ")}. Omit role for any-staff coverage.`
      : "No named roles exist — omit the role field on every requirement.",
    "Do not invent roles, days the business is closed, or hours outside operating hours.",
    "",
    "Include a short `summary` explaining the peaks/troughs you assumed, so the manager can confirm.",
  ].join("\n");
}

function buildUserContent(args: ForecastStaffingArgs): string {
  return [
    `Today is ${args.today}.`,
    "",
    "Business context (JSON):",
    JSON.stringify(args.context, null, 2),
    "",
    "Propose the staffing requirements.",
  ].join("\n");
}

/**
 * Run the forecast. Throws `DeepSeekStructuredError` if the model can't produce
 * schema-valid output after retries (the caller surfaces a friendly message).
 */
export async function forecastStaffing(
  args: ForecastStaffingArgs,
  deps: ForecastStaffingDeps,
): Promise<ForecastStaffing> {
  const { data } = await generateStructuredDeepSeek({
    chat: deps.chat,
    schema: forecastStaffingSchema,
    system: buildSystemPrompt(args.context.roster.roles),
    userContent: buildUserContent(args),
    model: deps.model ?? SCHEDULING_MODEL_PRO,
    toolName: "record_staffing_forecast",
    toolDescription: "Record the suggested staffing requirements.",
    maxRetries: deps.maxRetries,
    onUsage: deps.onUsage,
  });
  return data;
}

/** A forecast requirement resolved to DB columns (role name → role_certification_id). */
export type ResolvedStaffingRow = {
  role_certification_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  min_staff: number;
};

/**
 * Map each forecast requirement's role NAME to a `role_certification_id` from the
 * org's catalog (case-insensitive). An unmatched or absent role becomes null =
 * any-staff coverage. Pure, so the persistence path stays testable.
 */
export function resolveStaffingRoles(
  requirements: StaffingDay[],
  roles: Array<{ id: string; name: string }>,
): ResolvedStaffingRow[] {
  const byName = new Map(roles.map((r) => [r.name.trim().toLowerCase(), r.id]));
  return requirements.map((req) => ({
    role_certification_id: req.role ? (byName.get(req.role.trim().toLowerCase()) ?? null) : null,
    day_of_week: req.day_of_week,
    start_time: req.start_time,
    end_time: req.end_time,
    min_staff: req.min_staff,
  }));
}
