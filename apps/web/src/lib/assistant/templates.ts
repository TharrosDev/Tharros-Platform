import { GROUNDING_RULES } from "@/lib/documents/rag-prompt";

/**
 * Day 31 — generation templates. The assistant's three quick-actions turn the
 * grounded Q&A pipeline into a light generation surface: the user picks a
 * template (draft an email, write an SOP, summarize a policy) and types the
 * specifics; the template swaps the system prompt for a deliverable-shaped one
 * while keeping the Day-28/30 grounding + citation contract intact.
 *
 * This module is deliberately pure (no `server-only`, no I/O) so it can be
 * unit-tested directly — mirrors `lib/documents/rag-prompt.ts`. The route swaps
 * the prompt in via `buildRagRequest(..., { systemPrompt, instructionLabel })`.
 */

export type TemplateId = "draft_email" | "write_sop" | "summarize_policy";

/** UI-facing metadata for a template. Icons live in the component layer. */
export type TemplateMeta = {
  id: TemplateId;
  /** Short button label, e.g. "Draft email". */
  label: string;
  /** One-line description of what the template produces. */
  description: string;
  /** Composer placeholder prompting the user for the specifics. */
  placeholder: string;
};

/**
 * The deliverable-shaping half of each template's system prompt. Composed with
 * the shared intro + `GROUNDING_RULES` by `templateSystemPrompt`.
 */
const TEMPLATE_INSTRUCTIONS: Record<TemplateId, string> = {
  draft_email: `Your task is to draft a professional business email grounded in the SOURCES.
- Open with a "Subject:" line, then a greeting, body paragraphs, and a sign-off.
- Keep the tone professional, warm, and concise. Write in plain language.
- Ground every factual claim (policies, numbers, dates, terms) in the sources and cite it with [n].
- If the user has not said who the email is to or what it is about, draft a sensible default and keep the specifics general.`,
  write_sop: `Your task is to write a Standard Operating Procedure (SOP) grounded in the SOURCES.
- Start with a short title line, then a one-sentence "Purpose:".
- Lay out the procedure as clear, ordered numbered steps; use sub-bullets for details where helpful.
- Each step that states a rule, threshold, or requirement must cite its source with [n].
- Keep steps actionable and unambiguous — written so a new employee could follow them.`,
  summarize_policy: `Your task is to summarize the relevant policy from the SOURCES.
- Lead with a one-line plain-language summary, then a short bulleted breakdown of the key points.
- Surface concrete specifics — timeframes, amounts, exceptions, who it applies to — and cite each with [n].
- Do not add interpretation or advice beyond what the sources state.`,
};

/** Quick-action templates, in display order. */
export const TEMPLATES: TemplateMeta[] = [
  {
    id: "draft_email",
    label: "Draft email",
    description: "A professional email grounded in your documents",
    placeholder:
      "Who is it to, and what should it cover? e.g. reply to a customer asking about our refund window",
  },
  {
    id: "write_sop",
    label: "Write SOP",
    description: "A step-by-step procedure from your documents",
    placeholder: "Which process? e.g. how to handle a return request from intake to refund",
  },
  {
    id: "summarize_policy",
    label: "Summarize policy",
    description: "A plain-language summary of a policy",
    placeholder: "Which policy? e.g. summarize our remote-work policy",
  },
];

const TEMPLATE_IDS = new Set<string>(TEMPLATES.map((t) => t.id));

/** Type guard for validating an untrusted `template` field from the request body. */
export function isTemplateId(value: unknown): value is TemplateId {
  return typeof value === "string" && TEMPLATE_IDS.has(value);
}

/**
 * Build the system prompt for a generation template: the assistant identity +
 * the template's deliverable instructions + the shared `GROUNDING_RULES`, so a
 * generated draft is still sourced from the org's documents and cited with [n].
 */
export function templateSystemPrompt(id: TemplateId): string {
  return `You are the Tharros business assistant, producing a written deliverable strictly from the SOURCES below — internal documents a business has uploaded. Each source is labelled with a number, e.g. [1].

${TEMPLATE_INSTRUCTIONS[id]}

${GROUNDING_RULES}`;
}
