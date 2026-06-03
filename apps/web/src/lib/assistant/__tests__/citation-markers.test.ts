import { describe, expect, it } from "vitest";

import { splitCitationText } from "@/lib/assistant/citation-markers";

describe("splitCitationText", () => {
  it("splits a single marker out of surrounding text", () => {
    expect(splitCitationText("Refunds are 30 days [1] from purchase.")).toEqual([
      { type: "text", value: "Refunds are 30 days " },
      { type: "cite", n: 1 },
      { type: "text", value: " from purchase." },
    ]);
  });

  it("treats an adjacent run [1][2] as two separate cites", () => {
    expect(splitCitationText("Both apply [1][2].")).toEqual([
      { type: "text", value: "Both apply " },
      { type: "cite", n: 1 },
      { type: "cite", n: 2 },
      { type: "text", value: "." },
    ]);
  });

  it("returns a single text segment when there are no markers", () => {
    expect(splitCitationText("No citations here.")).toEqual([
      { type: "text", value: "No citations here." },
    ]);
  });

  it("leaves a non-numeric bracket as literal text", () => {
    expect(splitCitationText("See item [a] below.")).toEqual([
      { type: "text", value: "See item [a] below." },
    ]);
  });

  it("handles a marker at the very start", () => {
    expect(splitCitationText("[3] leads the sentence.")).toEqual([
      { type: "cite", n: 3 },
      { type: "text", value: " leads the sentence." },
    ]);
  });
});
