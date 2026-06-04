/**
 * Day 33 — Claude model ids + routing, kept pure (no `server-only`) so the
 * routing decision is unit-testable and importable anywhere. The client seam
 * (`./client`) re-exports these alongside the SDK instance.
 */

/**
 * Default model for product work — the highest tier the customer-facing features
 * (RAG assistant + scheduling agents) use. **Sonnet 4.6 at high effort**: strong
 * enough for grounded Q&A and the scheduling agent loop, at a fraction of Opus's
 * cost. Opus is deliberately reserved for later internal integration-management
 * work, not the chatbot/scheduling path (overkill + too expensive there). The
 * "high effort" half lives in `buildRagRequest` (output_config.effort).
 */
export const DEFAULT_MODEL = "claude-sonnet-4-6";

/**
 * Cheaper model for structured, lower-complexity work where the default's quality
 * isn't needed: the Day-31 generation templates (draft email / write SOP /
 * summarize policy). The biggest lever on unit economics.
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
