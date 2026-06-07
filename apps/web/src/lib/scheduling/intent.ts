import { z } from "zod";

import {
  generateStructuredDeepSeek,
  type DeepSeekChat,
  type DeepSeekUsage,
} from "@/lib/deepseek/structured";
import { SCHEDULING_MODEL_PRO } from "@/lib/deepseek/models";
import { DEFAULT_SOLVER_WEIGHTS, type SolverWeights } from "./solver";

/**
 * Day 47 — intent-translation agent. Turns a manager's fuzzy goals ("give Sarah
 * more weekends", "don't pair Tom and Jamie", "spread hours evenly") into solver
 * *inputs* — never assignments.
 *
 * The Day-46 solver accepts global {@link SolverWeights} + per-employee weekly
 * hour targets, so the agent maps to those (resolving employee names → ids from
 * the roster). Anything the frozen solver can't express today (specific-day
 * preferences, pairing/anti-pairing, role affinity) is emitted as a structured
 * `directive` for the Day-48 orchestrator to apply or surface; genuinely
 * un-actionable asks land in `unmapped`.
 *
 * Pure + provider-free (the DeepSeek `chat` seam is injected), mirroring the
 * Day-45 availability parser. Runs on `deepseek-v4-pro` (quality-critical).
 */

const weightsPartialSchema = z
  .object({
    hourTarget: z.number(),
    fairness: z.number(),
    seniority: z.number(),
    performance: z.number(),
    coverageGapPenalty: z.number(),
    laborSoft: z.number(),
  })
  .partial();

const employeeAdjustmentSchema = z.object({
  employeeId: z.string(),
  targetHoursWeekly: z.number().optional(),
  minHoursWeekly: z.number().optional(),
  maxHoursWeekly: z.number().optional(),
});

/** A goal the solver can't directly enforce yet — handed to the Day-48 orchestrator. */
const directiveSchema = z.object({
  type: z.enum([
    "avoid_pairing",
    "prefer_pairing",
    "prefer_days",
    "avoid_days",
    "prefer_employee_for_role",
    "cap_hours",
    "other",
  ]),
  /** Affected employees (ids resolved from the roster). */
  employeeIds: z.array(z.string()).optional(),
  /** Affected weekdays (0=Sun..6=Sat) for prefer_days/avoid_days. */
  days: z.array(z.number().int().min(0).max(6)).optional(),
  roleId: z.string().optional(),
  /** Plain-language restatement of the directive. */
  note: z.string(),
});

export const intentTranslationSchema = z.object({
  /** Global solver-weight tweaks (only the keys the goal touches). */
  weights: weightsPartialSchema.optional(),
  /** Per-employee weekly hour-target adjustments. */
  employeeAdjustments: z.array(employeeAdjustmentSchema).optional(),
  /** Richer constraints the solver can't enforce yet (for Day 48). */
  directives: z.array(directiveSchema).optional(),
  /** A short restatement of what was understood, shown to the manager. */
  summary: z.string(),
  /** Goals that couldn't be turned into any input. */
  unmapped: z.array(z.string()).optional(),
});

export type IntentTranslation = z.infer<typeof intentTranslationSchema>;

export type TranslateIntentArgs = {
  /** The manager's plain-language goals. */
  text: string;
  /** Roster for name → id resolution. */
  roster: Array<{ id: string; name: string }>;
  /** Current solver weights (defaults applied when omitted). */
  currentWeights?: SolverWeights;
};

export type TranslateIntentDeps = {
  chat: DeepSeekChat;
  model?: string;
  maxRetries?: number;
  onUsage?: (model: string, usage: DeepSeekUsage | null) => void | Promise<void>;
};

const WEIGHT_GUIDE = [
  "- hourTarget: how hard to hit each person's target weekly hours.",
  "- fairness: how evenly to spread hours across the team.",
  "- seniority: how much to favor more-senior employees.",
  "- performance: how much to favor higher-performing employees.",
  "- coverageGapPenalty: how strongly to avoid leaving shifts unfilled.",
  "- laborSoft: how strongly to avoid overtime + too many consecutive days.",
].join("\n");

function buildSystemPrompt(currentWeights: SolverWeights): string {
  return [
    "You translate a manager's plain-language scheduling goals into inputs for a",
    "deterministic scheduling solver. You NEVER assign people to shifts — you only",
    "produce inputs the solver will use.",
    "",
    "The solver accepts two kinds of inputs you can set directly:",
    "1. Global weights (higher = stronger). Only include the ones the goal changes:",
    WEIGHT_GUIDE,
    `Current weights: ${JSON.stringify(currentWeights)}.`,
    "2. Per-employee weekly hour targets: targetHoursWeekly / minHoursWeekly / maxHoursWeekly.",
    "   Resolve any employee NAME to its id using the roster; only use ids from the roster.",
    "",
    "Anything the solver can't directly enforce — a specific person's day preferences,",
    "pairing or anti-pairing two people, steering a person toward a role — must go in",
    "`directives` with the closest `type`, the resolved employeeIds/days/roleId, and a",
    "plain-language `note`. Put goals you cannot act on at all in `unmapped`.",
    "",
    "Always include a short `summary`. Do not invent employees or goals not stated.",
  ].join("\n");
}

function buildUserContent(args: TranslateIntentArgs): string {
  return [
    "Roster (id → name):",
    JSON.stringify(args.roster, null, 2),
    "",
    "Manager's goals:",
    args.text,
  ].join("\n");
}

/**
 * Translate manager goals into solver inputs. Throws `DeepSeekStructuredError` if
 * the model can't produce schema-valid output after retries.
 */
export async function translateIntent(
  args: TranslateIntentArgs,
  deps: TranslateIntentDeps,
): Promise<IntentTranslation> {
  const { data } = await generateStructuredDeepSeek({
    chat: deps.chat,
    schema: intentTranslationSchema,
    system: buildSystemPrompt(args.currentWeights ?? DEFAULT_SOLVER_WEIGHTS),
    userContent: buildUserContent(args),
    model: deps.model ?? SCHEDULING_MODEL_PRO,
    toolName: "record_scheduling_intent",
    toolDescription: "Record the translated scheduling inputs.",
    maxRetries: deps.maxRetries,
    onUsage: deps.onUsage,
  });
  return data;
}
