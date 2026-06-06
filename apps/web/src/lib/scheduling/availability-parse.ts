import { z } from "zod";

import {
  generateStructuredDeepSeek,
  type DeepSeekChat,
  type DeepSeekUsage,
} from "@/lib/deepseek/structured";
import { SCHEDULING_MODEL } from "@/lib/deepseek/models";
import { DAYS } from "@/components/scheduling/setup/model";

import { permanentDaySchema, temporaryOverrideSchema } from "./schemas";

/**
 * Day 45 — turn an employee's plain-language availability ("can't do Tuesdays
 * after 5, off June 20–25") into the structured whitelist the scheduler consumes.
 *
 * The actual model call runs on DeepSeek (the scheduling provider) via the
 * injected `chat` seam, so this stays provider-free + unit-testable. The schema is
 * the Day-44 availability shapes (`permanentDaySchema` / `temporaryOverrideSchema`)
 * plus a plain-language `summary` echoed back to the employee for the confirm step.
 */

/** The structured result the model returns: workable days + dated overrides + an echo. */
export const parsedAvailabilitySchema = z.object({
  /** Whitelist: only the weekdays the employee CAN work (`is_available` true). */
  permanent: z.array(permanentDaySchema).max(7),
  /** One-off dated exceptions (a blocked vacation, or an extra open day). */
  temporary: z.array(temporaryOverrideSchema),
  /** A short plain-language restatement, shown to the employee to confirm. */
  summary: z.string(),
});

export type ParsedAvailability = z.infer<typeof parsedAvailabilitySchema>;

export type ParseAvailabilityArgs = {
  /** The employee's free-text availability message. */
  text: string;
  /** Today's date (YYYY-MM-DD), injected so relative phrases ("next Friday") resolve. */
  today: string;
  /** The previous parse, when the employee is correcting it — fed back as context. */
  priorParse?: ParsedAvailability | null;
};

export type ParseAvailabilityDeps = {
  chat: DeepSeekChat;
  model?: string;
  maxRetries?: number;
  /** Metering seam — receives each model call's usage (map + recordUsage at the caller). */
  onUsage?: (model: string, usage: DeepSeekUsage | null) => void | Promise<void>;
};

const WEEKDAY_LEGEND = DAYS.map((d) => `${d.value}=${d.label}`).join(", ");

function buildSystemPrompt(today: string): string {
  return [
    "You convert an employee's plain-language work availability into structured JSON.",
    "",
    "Model = WHITELIST: list ONLY the weekdays the employee CAN work as `permanent`",
    "entries with is_available=true. Omit days they cannot or did not mention.",
    `Weekday numbers: ${WEEKDAY_LEGEND}.`,
    "Times are 24-hour 'HH:MM'. Omit start_time/end_time for a whole workable day.",
    "If they give a partial limit ('not after 5pm'), set the workable window (e.g. 09:00–17:00)",
    "using the business's typical hours when a bound is implied but unstated.",
    "",
    "`temporary` holds one-off DATED exceptions: a blocked vacation is is_available=false;",
    "an extra one-off day is is_available=true. Dates are 'YYYY-MM-DD'; use end_date for ranges.",
    `Today is ${today} — resolve relative dates ('next Friday', 'the 20th') against it.`,
    "",
    "Always include a short, friendly `summary` restating what you understood, so the",
    "employee can confirm or correct it. Do not invent availability they did not state.",
  ].join("\n");
}

function buildUserContent(text: string, priorParse?: ParsedAvailability | null): string {
  if (!priorParse) return text;
  return [
    "Here is what was understood previously:",
    JSON.stringify(priorParse, null, 2),
    "",
    "The employee is now correcting it. Apply this change and return the full updated availability:",
    text,
  ].join("\n");
}

/**
 * Parse one availability message into the structured whitelist. Throws
 * `DeepSeekStructuredError` if the model can't produce schema-valid output after
 * retries (the caller surfaces a friendly "couldn't read that" message).
 */
export async function parseAvailabilityText(
  args: ParseAvailabilityArgs,
  deps: ParseAvailabilityDeps,
): Promise<ParsedAvailability> {
  const { data } = await generateStructuredDeepSeek({
    chat: deps.chat,
    schema: parsedAvailabilitySchema,
    system: buildSystemPrompt(args.today),
    userContent: buildUserContent(args.text, args.priorParse),
    model: deps.model ?? SCHEDULING_MODEL,
    toolName: "record_availability",
    toolDescription: "Record the employee's structured availability.",
    maxRetries: deps.maxRetries,
    onUsage: deps.onUsage,
  });
  return data;
}
