import type { DeepSeekUsage } from "./structured";

/**
 * Day 45 — map a DeepSeek/OpenAI usage block to the four token counts the Day-33
 * metering seam records (`lib/billing/usage` + `lib/billing/ai-pricing`).
 *
 * The metering math follows Anthropic's convention: `input_tokens` EXCLUDES the
 * cached portion (cache-read is billed separately). DeepSeek's `prompt_tokens`
 * INCLUDES cache hits, and reports the split as `prompt_cache_hit_tokens` /
 * `prompt_cache_miss_tokens`. So: cache-miss → input, cache-hit → cache-read.
 * DeepSeek has no separate cache-CREATION charge, so that count is always 0.
 */
export type MeteredUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
};

export function mapDeepSeekUsage(usage: DeepSeekUsage | null): MeteredUsage | null {
  if (!usage) return null;

  const cacheRead = usage.prompt_cache_hit_tokens ?? 0;
  // Prefer the explicit cache-miss count; otherwise the whole prompt is uncached.
  const input = usage.prompt_cache_miss_tokens ?? usage.prompt_tokens ?? 0;

  return {
    input_tokens: input,
    output_tokens: usage.completion_tokens ?? 0,
    cache_read_input_tokens: cacheRead,
    cache_creation_input_tokens: 0,
  };
}
