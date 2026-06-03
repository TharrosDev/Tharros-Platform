/**
 * Day 33 — Claude model ids + routing, kept pure (no `server-only`) so the
 * routing decision is unit-testable and importable anywhere. The client seam
 * (`./client`) re-exports these alongside the SDK instance.
 */

/**
 * Default model for product work. Opus 4.8 is the most capable model and the
 * baseline for the RAG assistant + agents. Open-ended grounded Q&A runs here —
 * quality earns the cost.
 */
export const DEFAULT_MODEL = "claude-opus-4-8";

/**
 * Cheaper model for structured, lower-complexity work where Opus quality isn't
 * needed: the Day-31 generation templates (draft email / write SOP / summarize
 * policy). The biggest lever on unit economics.
 */
export const CHEAP_MODEL = "claude-haiku-4-5";

/**
 * Pick the model for an assistant turn: a generation template routes to the
 * cheap model; plain open-ended Q&A (no template) stays on the default. Kept
 * deliberately simple — no chunk-count or question-complexity heuristics yet.
 */
export function modelForTemplate(template: string | null | undefined): string {
  return template ? CHEAP_MODEL : DEFAULT_MODEL;
}
