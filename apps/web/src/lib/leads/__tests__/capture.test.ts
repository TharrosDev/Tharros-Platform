import { beforeEach, describe, expect, it, vi } from "vitest";

import { PostgrestDouble } from "@/lib/__tests__/postgrest-double";

/*
  The public capture seam is the only anonymous write path in the product.
  CLAUDE.md is explicit that it must never become a raw anonymous insert: it
  has to pass through the server-only seam, the form-token lookup, rate
  limiting and the Growth/Pro entitlement check. These tests pin that order
  and those refusals, because a regression here is not a visual one.
*/

const db = new PostgrestDouble();
const checkRateLimit = vi.fn(async () => ({ allowed: true, remaining: 9 }));
const createNotification = vi.fn(async (_admin: unknown, _input: Record<string, unknown>) => {});
const recordLeadEvent = vi.fn(async (_admin: unknown, _input: Record<string, unknown>) => {});

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => db.client }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit }));
vi.mock("@/lib/notifications/notify", () => ({ createNotification }));
vi.mock("@/lib/leads/events", () => ({ recordLeadEvent }));
vi.mock("@/lib/observability/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { capturePublicLead, getPublicCaptureForm } = await import("@/lib/leads/capture");

const FORM_ROW = {
  id: "form-1",
  org_id: "org-1",
  name: "Website enquiries",
  public_token: "tok_live",
  headline: "Tell us what you need",
  success_message: "Thanks, we will be in touch.",
  active: true,
  created_at: "2026-09-01T00:00:00.000Z",
  updated_at: "2026-09-01T00:00:00.000Z",
};

const GROWTH = { status: "active", tier: "growth" };

const INPUT = {
  name: "Rivergate Dental",
  email: "hello@example.test",
  phone: null,
  company: null,
  message: "We need scheduling for six staff.",
};

function script(over: Record<string, unknown> = {}) {
  db.setScript({
    lead_capture_forms: { data: FORM_ROW, error: null },
    subscriptions: { data: GROWTH, error: null },
    "leads.insert": { data: { id: "lead-9" }, error: null },
    memberships: { data: [{ user_id: "owner-1", role: "owner" }], error: null },
    ...over,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimit.mockResolvedValue({ allowed: true, remaining: 9 });
  script();
});

describe("getPublicCaptureForm", () => {
  it("returns nothing for a token that matches no active form", async () => {
    script({ lead_capture_forms: { data: null, error: null } });
    await expect(getPublicCaptureForm("tok_missing")).resolves.toBeNull();
  });

  it("only looks up forms that are active", async () => {
    await getPublicCaptureForm("tok_live");
    expect(db.callsTo("lead_capture_forms")[0]?.filters).toMatchObject({
      public_token: "tok_live",
      active: true,
    });
  });

  it("hides a real form when the org has dropped below Growth", async () => {
    script({ subscriptions: { data: { status: "active", tier: "starter" }, error: null } });
    await expect(getPublicCaptureForm("tok_live")).resolves.toBeNull();
  });

  it("hides a real form when the subscription is no longer active", async () => {
    script({ subscriptions: { data: { status: "canceled", tier: "pro" }, error: null } });
    await expect(getPublicCaptureForm("tok_live")).resolves.toBeNull();
  });

  it("returns the form for an entitled org", async () => {
    await expect(getPublicCaptureForm("tok_live")).resolves.toMatchObject({
      id: "form-1",
      orgId: "org-1",
      headline: "Tell us what you need",
    });
  });
});

describe("capturePublicLead", () => {
  it("refuses an unknown token without touching leads", async () => {
    script({ lead_capture_forms: { data: null, error: null } });
    await expect(capturePublicLead("tok_missing", INPUT, "ip-1")).resolves.toEqual({
      ok: false,
      reason: "invalid_form",
    });
    expect(db.callsTo("leads", "insert")).toHaveLength(0);
  });

  it("refuses an org below Growth before spending a rate-limit bucket", async () => {
    script({ subscriptions: { data: { status: "active", tier: "starter" }, error: null } });
    await expect(capturePublicLead("tok_live", INPUT, "ip-1")).resolves.toEqual({
      ok: false,
      reason: "inactive_plan",
    });
    expect(checkRateLimit).not.toHaveBeenCalled();
    expect(db.callsTo("leads", "insert")).toHaveLength(0);
  });

  it("checks a per-visitor and a per-form bucket, and never fails open", async () => {
    await capturePublicLead("tok_live", INPUT, "ip-1");

    expect(checkRateLimit).toHaveBeenCalledTimes(2);
    const [visitor, form] = checkRateLimit.mock.calls as unknown as [
      [string, number, number, { failOpen: boolean }],
      [string, number, number, { failOpen: boolean }],
    ];
    expect(visitor[0]).toBe("lead-capture:form-1:requester:ip-1");
    expect(form[0]).toBe("lead-capture:form-1:form");
    // A database blip must close this path, not open it.
    expect(visitor[3]).toEqual({ failOpen: false });
    expect(form[3]).toEqual({ failOpen: false });
  });

  it("refuses when either bucket is exhausted", async () => {
    checkRateLimit.mockResolvedValueOnce({ allowed: false, remaining: 0 });
    await expect(capturePublicLead("tok_live", INPUT, "ip-1")).resolves.toEqual({
      ok: false,
      reason: "rate_limited",
    });
    expect(db.callsTo("leads", "insert")).toHaveLength(0);
  });

  it("writes the lead with the public source and the new status", async () => {
    await expect(capturePublicLead("tok_live", INPUT, "ip-1")).resolves.toEqual({
      ok: true,
      leadId: "lead-9",
    });

    expect(db.callsTo("leads", "insert")[0]?.payload).toMatchObject({
      org_id: "org-1",
      capture_form_id: "form-1",
      name: "Rivergate Dental",
      source: "public_form",
      status: "new",
    });
  });

  it("records the lead.created event that automations trigger on", async () => {
    await capturePublicLead("tok_live", INPUT, "ip-1");

    expect(recordLeadEvent).toHaveBeenCalledTimes(1);
    expect(recordLeadEvent.mock.calls[0]?.[1]).toMatchObject({
      orgId: "org-1",
      leadId: "lead-9",
      type: "lead.created",
      data: { source: "public_form", captureFormId: "form-1" },
    });
  });

  it("notifies the managers, and only the managers", async () => {
    script({
      memberships: {
        data: [
          { user_id: "owner-1", role: "owner" },
          { user_id: "admin-1", role: "admin" },
        ],
        error: null,
      },
    });
    await capturePublicLead("tok_live", INPUT, "ip-1");

    expect(db.callsTo("memberships")[0]?.filters).toMatchObject({
      org_id: "org-1",
      role: ["owner", "admin"],
    });
    expect(createNotification).toHaveBeenCalledTimes(2);
    expect(createNotification.mock.calls[0]?.[1]).toMatchObject({
      type: "new_lead",
      data: { leadId: "lead-9" },
      email: true,
    });
  });

  it("raises rather than reporting success when the insert fails", async () => {
    script({ "leads.insert": { data: null, error: { message: "insert failed" } } });
    await expect(capturePublicLead("tok_live", INPUT, "ip-1")).rejects.toMatchObject({
      message: "insert failed",
    });
    expect(recordLeadEvent).not.toHaveBeenCalled();
  });
});
