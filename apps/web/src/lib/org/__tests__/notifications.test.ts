import { describe, expect, it } from "vitest";

import {
  NOTIFICATION_DEFAULTS,
  notificationsSchema,
  resolveNotifications,
} from "@/lib/org/schemas";

/**
 * Day 21 — pure unit tests for notification-preference parsing/merging. No
 * Supabase; covers the jsonb→form round trip the settings page relies on.
 */
describe("resolveNotifications", () => {
  it("returns the defaults for an empty/missing map", () => {
    expect(resolveNotifications(null)).toEqual(NOTIFICATION_DEFAULTS);
    expect(resolveNotifications({})).toEqual(NOTIFICATION_DEFAULTS);
  });

  it("merges a partial stored map onto the defaults", () => {
    expect(resolveNotifications({ new_lead: false })).toEqual({
      ...NOTIFICATION_DEFAULTS,
      new_lead: false,
    });
  });

  it("ignores non-boolean and unknown keys", () => {
    const out = resolveNotifications({ new_lead: "yes", bogus: true });
    expect(out).toEqual(NOTIFICATION_DEFAULTS);
    expect(out).not.toHaveProperty("bogus");
  });
});

describe("notificationsSchema", () => {
  it("accepts a complete boolean map", () => {
    const parsed = notificationsSchema.safeParse({
      new_lead: true,
      weekly_summary: false,
      billing_account: true,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a missing key", () => {
    const parsed = notificationsSchema.safeParse({
      new_lead: true,
      weekly_summary: false,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a non-boolean value", () => {
    const parsed = notificationsSchema.safeParse({
      new_lead: "on",
      weekly_summary: false,
      billing_account: true,
    });
    expect(parsed.success).toBe(false);
  });
});
