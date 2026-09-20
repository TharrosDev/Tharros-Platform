/**
 * Day 48 — the orchestrator's LLM advisor seam (DeepSeek `v4-pro`).
 *
 * The hybrid loop is deterministic; the advisor only does the things that need
 * judgment or natural language and that CANNOT change whether coverage is met:
 *   1. `adviseDirectiveNudges` — turn manager directives the frozen solver can't
 *      enforce (day preferences, pairing…) into global weight nudges, at baseline
 *      assembly (before the loop).
 *   2. `draftEscalationMessage` / `summarizeOptimization` — plain-language copy for
 *      an escalation and the run recap.
 *
 * Pure + provider-free like `intent.ts`: the DeepSeek `chat` seam is injected, so
 * the unit harness fakes it. Each function degrades gracefully to a deterministic
 * template if the model errors — copy is never load-bearing. Deterministic
 * templates (`default*`) are exported so the no-LLM path (e.g. the DB test) reuses
 * them.
 */

import { z } from "zod";

import {
  generateStructuredDeepSeek,
  type DeepSeekChat,
  type DeepSeekUsage,
} from "@/lib/deepseek/structured";
import { SCHEDULING_MODEL_PRO } from "@/lib/deepseek/models";
import { DEFAULT_SOLVER_WEIGHTS, type SolverWeights } from "../solver/types";
import type { IntentTranslation } from "../intent";
import type { Escalation, OptimizeTrace } from "./types";

export type AdvisorDeps = {
  chat: DeepSeekChat;
  model?: string;
  maxRetries?: number;
  onUsage?: (model: string, usage: DeepSeekUsage | null) => void | Promise<void>;
};

// ---------------------------------------------------------------------------
// Deterministic fallbacks (pure) — also the no-LLM path.
// ---------------------------------------------------------------------------

export function defaultEscalationMessage(esc: Escalation): string {
  const who = esc.employeeIds.length ? esc.employeeIds.join(", ") : "—";
  switch (esc.kind) {
    case "propose_overtime":
      return `Coverage gap on ${esc.date} (${esc.missing} unfilled). Qualified staff are available but only legal overtime beyond their hours could fill it. Approve overtime for: ${who}.`;
    case "request_availability":
      return `Coverage gap on ${esc.date} (${esc.missing} unfilled). No qualified employee is available for this window — ask these employees to add availability: ${who}.`;
    case "manager_decision":
      return `Coverage gap on ${esc.date} (${esc.missing} unfilled). No employee holds the required role — a hiring or cross-training decision is needed.`;
  }
}

export function defaultSummary(args: {
  covered: boolean;
  trace: OptimizeTrace;
  escalations: Escalation[];
}): string {
  const rounds = Math.max(0, args.trace.length - 1);
  if (args.covered) {
    return rounds === 0
      ? "All shifts covered on the first solve."
      : `All shifts covered after ${rounds} automatic adjustment(s).`;
  }
  const byKind = args.escalations.reduce<Record<string, number>>((acc, e) => {
    acc[e.kind] = (acc[e.kind] ?? 0) + 1;
    return acc;
  }, {});
  const parts = Object.entries(byKind).map(([k, n]) => `${n} ${k.replace(/_/g, " ")}`);
  return `${args.escalations.length} coverage gap(s) remain after ${rounds} automatic adjustment(s): ${parts.join(", ")}.`;
}

// ---------------------------------------------------------------------------
// Directive interpretation (baseline assembly, before the loop).
// ---------------------------------------------------------------------------

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

const directiveNudgeSchema = z.object({
  weights: weightsPartialSchema.optional(),
  notes: z.array(z.string()).optional(),
});

export type DirectiveNudge = z.infer<typeof directiveNudgeSchema>;

/**
 * Interpret directives the solver can't enforce directly into global weight nudges
 * (e.g. a strong "spread hours evenly" → bump `fairness`). Returns only weight
 * tweaks — never assignments. Falls back to no nudges on model error.
 */
export async function adviseDirectiveNudges(
  args: {
    directives: NonNullable<IntentTranslation["directives"]>;
    currentWeights?: SolverWeights;
  },
  deps: AdvisorDeps,
): Promise<DirectiveNudge> {
  if (args.directives.length === 0) return {};
  const currentWeights = args.currentWeights ?? DEFAULT_SOLVER_WEIGHTS;

  const system = [
    "You tune a deterministic scheduling solver's GLOBAL weights to best honor",
    "manager directives the solver cannot enforce directly (specific-day",
    "preferences, pairing/anti-pairing, role affinity). You NEVER assign people.",
    "Only nudge weights that genuinely help; leave the rest untouched.",
    `Current weights: ${JSON.stringify(currentWeights)}.`,
    "Weights: hourTarget, fairness, seniority, performance, coverageGapPenalty, laborSoft.",
    "Keep coverageGapPenalty dominant — never lower it. Add short notes explaining each nudge.",
  ].join("\n");

  const userContent = [
    "Directives the solver can't enforce:",
    JSON.stringify(args.directives, null, 2),
  ].join("\n");

  try {
    const { data } = await generateStructuredDeepSeek({
      chat: deps.chat,
      schema: directiveNudgeSchema,
      system,
      userContent,
      model: deps.model ?? SCHEDULING_MODEL_PRO,
      toolName: "record_directive_nudges",
      toolDescription: "Record global solver-weight nudges that honor the directives.",
      maxRetries: deps.maxRetries,
      onUsage: deps.onUsage,
    });
    return data;
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Escalation copy + run summary.
// ---------------------------------------------------------------------------

const messageSchema = z.object({ message: z.string() });

/** A short, manager-facing message for one escalation. Falls back to a template. */
export async function draftEscalationMessage(esc: Escalation, deps: AdvisorDeps): Promise<string> {
  const system = [
    "You write one short, plain message to a small-business manager about a",
    "staffing coverage gap. Be direct and concrete. No greetings or sign-offs.",
    "State the date, what's missing, and the specific action requested. 1-2 sentences.",
  ].join("\n");

  const userContent = JSON.stringify(
    {
      date: esc.date,
      kind: esc.kind,
      missing: esc.missing,
      employeeIds: esc.employeeIds,
      reason: esc.reason,
    },
    null,
    2,
  );

  try {
    const { data } = await generateStructuredDeepSeek({
      chat: deps.chat,
      schema: messageSchema,
      system,
      userContent,
      model: deps.model ?? SCHEDULING_MODEL_PRO,
      toolName: "record_message",
      toolDescription: "Record the manager-facing escalation message.",
      maxRetries: deps.maxRetries,
      onUsage: deps.onUsage,
    });
    return data.message.trim() || defaultEscalationMessage(esc);
  } catch {
    return defaultEscalationMessage(esc);
  }
}

const summarySchema = z.object({ summary: z.string() });

/** A plain-language recap of the whole optimization run. Falls back to a template. */
export async function summarizeOptimization(
  args: { covered: boolean; trace: OptimizeTrace; escalations: Escalation[] },
  deps: AdvisorDeps,
): Promise<string> {
  const system = [
    "You summarize a scheduling optimization run for a small-business manager in",
    "1-3 plain sentences. Say whether all shifts were covered, what automatic",
    "adjustments were tried, and what (if anything) needs the manager's decision.",
  ].join("\n");

  const userContent = JSON.stringify(
    {
      covered: args.covered,
      adjustments: args.trace.filter((s) => s.remedy).map((s) => s.remedy?.kind),
      escalations: args.escalations.map((e) => ({
        kind: e.kind,
        date: e.date,
        missing: e.missing,
      })),
    },
    null,
    2,
  );

  try {
    const { data } = await generateStructuredDeepSeek({
      chat: deps.chat,
      schema: summarySchema,
      system,
      userContent,
      model: deps.model ?? SCHEDULING_MODEL_PRO,
      toolName: "record_summary",
      toolDescription: "Record the run summary.",
      maxRetries: deps.maxRetries,
      onUsage: deps.onUsage,
    });
    return data.summary.trim() || defaultSummary(args);
  } catch {
    return defaultSummary(args);
  }
}
