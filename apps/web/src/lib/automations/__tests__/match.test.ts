import { describe, expect, it } from "vitest";

import { matchesAutomationEvent } from "../match";

describe("matchesAutomationEvent", () => {
  it("matches a normal event when trigger types are equal", () => {
    expect(
      matchesAutomationEvent({
        manual: false,
        eventType: "lead.created",
        eventData: { source: "public_form" },
        triggerType: "lead.created",
        triggerConfig: {},
      }),
    ).toBe(true);
  });

  it("rejects a different event type", () => {
    expect(
      matchesAutomationEvent({
        manual: false,
        eventType: "lead.created",
        eventData: {},
        triggerType: "lead.status_changed",
        triggerConfig: {},
      }),
    ).toBe(false);
  });

  it("applies the target-status filter", () => {
    expect(
      matchesAutomationEvent({
        manual: false,
        eventType: "lead.status_changed",
        eventData: { from: "new", to: "qualified" },
        triggerType: "lead.status_changed",
        triggerConfig: { toStatus: "qualified" },
      }),
    ).toBe(true);

    expect(
      matchesAutomationEvent({
        manual: false,
        eventType: "lead.status_changed",
        eventData: { from: "new", to: "contacted" },
        triggerType: "lead.status_changed",
        triggerConfig: { toStatus: "qualified" },
      }),
    ).toBe(false);
  });

  it("allows an explicitly targeted manual run regardless of event shape", () => {
    expect(
      matchesAutomationEvent({
        manual: true,
        eventType: "automation.action",
        eventData: { action: "manual_run_requested" },
        triggerType: "lead.status_changed",
        triggerConfig: { toStatus: "won" },
      }),
    ).toBe(true);
  });
});
