import { describe, expect, it } from "vitest";

import { buildHistory, buildRewriteRequest } from "../history";

describe("buildHistory", () => {
  it("keeps the newest turns within budget and starts on a user turn", () => {
    const turns = [
      { role: "user" as const, content: "a".repeat(40) },
      { role: "assistant" as const, content: "b".repeat(40) },
      { role: "user" as const, content: "c".repeat(40) },
      { role: "assistant" as const, content: "d".repeat(40) },
    ];
    // 25 tokens ≈ 100 chars → only the last two turns fit.
    const h = buildHistory(turns, 25);
    expect(h.map((m) => m.content)).toEqual(["c".repeat(40), "d".repeat(40)]);
  });

  it("drops a leading assistant turn left after trimming", () => {
    const h = buildHistory(
      [
        { role: "user", content: "x".repeat(80) },
        { role: "assistant", content: "yy" },
        { role: "user", content: "zz" },
      ],
      2,
    );
    expect(h).toEqual([{ role: "user", content: "zz" }]);
  });

  it("strips stale citation markers from assistant turns", () => {
    const h = buildHistory([
      { role: "user", content: "Refunds?" },
      { role: "assistant", content: "Refunds are 30 days [1][2]." },
    ]);
    expect(h[1].content).toBe("Refunds are 30 days.");
  });

  it("returns nothing for a first turn", () => {
    expect(buildHistory([])).toEqual([]);
  });
});

describe("buildRewriteRequest", () => {
  it("embeds the transcript and latest message for the cheap model", () => {
    const req = buildRewriteRequest(
      [
        { role: "user", content: "Vacation policy?" },
        { role: "assistant", content: "Full-timers get 3 weeks." },
      ],
      "what about part-timers?",
      "claude-haiku-4-5",
    );
    expect(req.model).toBe("claude-haiku-4-5");
    expect(req).not.toHaveProperty("thinking");
    const content = req.messages[0].content as string;
    expect(content).toContain("User: Vacation policy?");
    expect(content).toContain("Latest message: what about part-timers?");
  });
});
