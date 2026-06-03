/**
 * Day 33 — rough Claude cost estimation for the owner usage dashboard.
 *
 * Pure + provider-free (no `server-only`) so it can be unit-tested and imported
 * anywhere. Rates are Anthropic's published list prices in **USD per million
 * tokens** — Anthropic bills in USD, so the dashboard figure is an estimate
 * labelled as USD, not the CAD the customer is charged. Cache writes cost more
 * than base input; cache reads cost a fraction of it.
 *
 * These are estimates: keep them roughly current, but the metering rows
 * (`ai_usage_events`) are the source of truth for token counts.
 */

export type ModelRates = {
  /** USD per 1M input tokens. */
  input: number;
  /** USD per 1M output tokens. */
  output: number;
  /** USD per 1M cache-write (cache-creation) input tokens. */
  cacheWrite: number;
  /** USD per 1M cache-read input tokens. */
  cacheRead: number;
};

/** USD list prices per 1M tokens. Update if Anthropic's pricing changes. */
export const MODEL_RATES: Record<string, ModelRates> = {
  "claude-opus-4-8": { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5 },
  "claude-haiku-4-5": { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.1 },
};

export type TokenCounts = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
};

/**
 * Estimate the USD cost (in whole cents, rounded) of a set of token counts for
 * a model. Unknown models cost 0 (we'd rather under-report than invent a rate)
 * — callers can surface that the model is unpriced if it matters.
 *
 * Note the Anthropic `Usage` shape: `input_tokens` already EXCLUDES the cached
 * portions, so input / cache-read / cache-write are summed without double
 * counting.
 */
export function estimateCostCents(counts: TokenCounts): number {
  const rates = MODEL_RATES[counts.model];
  if (!rates) return 0;

  const perToken = (perMillion: number) => perMillion / 1_000_000;
  const usd =
    counts.inputTokens * perToken(rates.input) +
    counts.outputTokens * perToken(rates.output) +
    counts.cacheReadTokens * perToken(rates.cacheRead) +
    counts.cacheCreationTokens * perToken(rates.cacheWrite);

  return Math.round(usd * 100);
}

/** Format USD cents as a dollar string, e.g. 1234 → "$12.34". */
export function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
