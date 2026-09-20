import { describe, expect, it } from "vitest";

import {
  formatRelativeTime,
  mapNotification,
  notificationLink,
  prefKeyForType,
  type NotificationRow,
} from "@/lib/notifications/types";

/**
 * Day 40 — notification pure helpers. Provider-free.
 */

describe("prefKeyForType", () => {
  it("maps gated types to their org preference key", () => {
    expect(prefKeyForType("billing")).toBe("billing_account");
    expect(prefKeyForType("new_lead")).toBe("new_lead");
    expect(prefKeyForType("weekly_summary")).toBe("weekly_summary");
  });

  it("returns null for ungated (transactional) types", () => {
    expect(prefKeyForType("system")).toBeNull();
    expect(prefKeyForType("agent_handoff")).toBeNull();
    expect(prefKeyForType("anything-else")).toBeNull();
  });
});

describe("notificationLink", () => {
  it("extracts a url + label", () => {
    expect(notificationLink({ url: "/x", label: "Open" })).toEqual({ url: "/x", label: "Open" });
  });
  it("defaults the label and returns null without a url", () => {
    expect(notificationLink({ url: "/x" })).toEqual({ url: "/x", label: "View" });
    expect(notificationLink({})).toBeNull();
    expect(notificationLink({ label: "no url" })).toBeNull();
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-06-04T12:00:00Z").getTime();
  it("buckets recent times", () => {
    expect(formatRelativeTime("2026-06-04T11:59:40Z", now)).toBe("just now");
    expect(formatRelativeTime("2026-06-04T11:55:00Z", now)).toBe("5m");
    expect(formatRelativeTime("2026-06-04T09:00:00Z", now)).toBe("3h");
    expect(formatRelativeTime("2026-06-02T12:00:00Z", now)).toBe("2d");
  });
  it("falls back to a short date past a week", () => {
    expect(formatRelativeTime("2026-05-01T12:00:00Z", now)).toMatch(/\w{3}/);
  });
  it("returns empty for an invalid date", () => {
    expect(formatRelativeTime("not-a-date", now)).toBe("");
  });
});

describe("mapNotification", () => {
  it("maps snake_case rows and defaults null data", () => {
    const row: NotificationRow = {
      id: "n1",
      org_id: "o1",
      user_id: "u1",
      type: "system",
      title: "Hi",
      body: "Body",
      data: null,
      read_at: null,
      email: true,
      email_status: "pending",
      created_at: "2026-06-04T12:00:00Z",
    };
    const n = mapNotification(row);
    expect(n).toMatchObject({
      id: "n1",
      orgId: "o1",
      userId: "u1",
      email: true,
      emailStatus: "pending",
      data: {},
    });
    expect(n.readAt).toBeNull();
  });
});
