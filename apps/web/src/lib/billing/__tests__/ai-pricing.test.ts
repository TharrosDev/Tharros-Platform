import { describe, expect, it } from "vitest";

import { estimateCostCents, formatUsd, MODEL_RATES } from "../ai-pricing";

/**
 * Day 33 — Claude cost estimation. Pure; rates are USD list prices per 1M
 * tokens. These are estimates for the owner dashboard, not the billed CAD.
 */

describe("estimateCostCents", () => {
  it("prices Opus input + output (no cache)", () => {
    // 1M input @ $15 + 1M output @ $75 = $90.00 = 9000 cents.
    const cents = estimateCostCents({
      model: "claude-opus-4-8",
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
    });
    expect(cents).toBe(9000);
  });

  it("prices Haiku far below Opus for the same tokens", () => {
    const counts = {
      inputTokens: 500_000,
      outputTokens: 200_000,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
    };
    const opus = estimateCostCents({ model: "claude-opus-4-8", ...counts });
    const haiku = estimateCostCents({ model: "claude-haiku-4-5", ...counts });
    expect(haiku).toBeGreaterThan(0);
    expect(haiku).toBeLessThan(opus);
  });

  it("charges cache reads cheaply and cache writes at a premium", () => {
    // 1M cache-read @ $1.50 = $1.50 = 150 cents (Opus).
    const read = estimateCostCents({
      model: "claude-opus-4-8",
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 1_000_000,
      cacheCreationTokens: 0,
    });
    // 1M cache-write @ $18.75 = 1875 cents.
    const write = estimateCostCents({
      model: "claude-opus-4-8",
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 1_000_000,
    });
    expect(read).toBe(150);
    expect(write).toBe(1875);
    expect(read).toBeLessThan(write);
  });

  it("returns 0 for an unknown/unpriced model rather than inventing a rate", () => {
    expect(
      estimateCostCents({
        model: "claude-mystery-9",
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
      }),
    ).toBe(0);
  });

  it("knows both routed models", () => {
    expect(MODEL_RATES["claude-opus-4-8"]).toBeDefined();
    expect(MODEL_RATES["claude-haiku-4-5"]).toBeDefined();
  });
});

describe("formatUsd", () => {
  it("formats cents as a 2dp dollar string", () => {
    expect(formatUsd(0)).toBe("$0.00");
    expect(formatUsd(1234)).toBe("$12.34");
    expect(formatUsd(5)).toBe("$0.05");
  });
});
