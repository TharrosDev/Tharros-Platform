import { describe, expect, it } from "vitest";

import { mapDeepSeekUsage } from "../usage";

/**
 * Day 45 — DeepSeek → metering usage mapping. The Day-33 `recordUsage` +
 * `estimateCostCents` expect the Anthropic convention where `input_tokens`
 * EXCLUDES cached tokens. DeepSeek's `prompt_tokens` INCLUDES cache hits, so we
 * map cache-miss → input, cache-hit → cache-read to avoid double counting.
 */

describe("mapDeepSeekUsage", () => {
  it("splits cache-miss into input and cache-hit into cache-read", () => {
    expect(
      mapDeepSeekUsage({
        prompt_tokens: 1000,
        completion_tokens: 200,
        prompt_cache_hit_tokens: 600,
        prompt_cache_miss_tokens: 400,
      }),
    ).toEqual({
      input_tokens: 400,
      output_tokens: 200,
      cache_read_input_tokens: 600,
      cache_creation_input_tokens: 0,
    });
  });

  it("falls back to prompt_tokens for input when no cache breakdown is given", () => {
    expect(mapDeepSeekUsage({ prompt_tokens: 50, completion_tokens: 10 })).toEqual({
      input_tokens: 50,
      output_tokens: 10,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    });
  });

  it("returns null for null usage", () => {
    expect(mapDeepSeekUsage(null)).toBeNull();
  });
});
