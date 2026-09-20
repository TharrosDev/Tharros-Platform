import { beforeEach, describe, expect, it, vi } from "vitest";

/*
  `automation-dispatch` is the durable job that runs a customer's automations
  when a lead event lands. It is the only path by which Tharros changes a
  lead, notifies a manager or spends an AI query without a person present, and
  it had no coverage at all.

  These are pure unit tests over a scripted Supabase double. The database
  guarantees it relies on (the unique index behind the 23505 reclaim, RLS) are
  covered by the db suites; what is checked here is the decision logic: who is
  allowed to run, what matches, what each action does, and what happens when
  one automation in a batch fails.
*/

const createNotification = vi.fn(async (_admin: unknown, _input: Record<string, unknown>) => {});
const checkOrgQueryCap = vi.fn(async () => ({ allowed: true }) as { allowed: boolean });
const generateLeadFollowUpDraft = vi.fn(async () => {});

/** One scripted response, keyed by table and verb. */
type Reply = { data?: unknown; error?: unknown };
type Call = { table: string; verb: string; payload?: unknown; filters: Record<string, unknown> };

let calls: Call[] = [];
let script: Record<string, Reply | ((call: Call) => Reply)> = {};

function reply(call: Call): Reply {
  const entry = script[`${call.table}.${call.verb}`] ?? script[call.table];
  const result = typeof entry === "function" ? entry(call) : entry;
  return result ?? { data: null, error: null };
}

/**
 * A thenable query builder. PostgREST chains are terminal in several
 * different ways (`single`, `maybeSingle`, or awaiting the builder itself),
 * so all three resolve through the same path.
 */
class Query implements PromiseLike<Reply> {
  private filters: Record<string, unknown> = {};

  constructor(
    private table: string,
    private verb: string,
    private payload?: unknown,
  ) {}

  select() {
    return this;
  }
  eq(key: string, value: unknown) {
    this.filters[key] = value;
    return this;
  }
  in(key: string, value: unknown) {
    this.filters[key] = value;
    return this;
  }
  lte() {
    return this;
  }
  private run(): Promise<Reply> {
    const call: Call = {
      table: this.table,
      verb: this.verb,
      payload: this.payload,
      filters: this.filters,
    };
    calls.push(call);
    const result = reply(call);
    return result.error ? Promise.resolve(result) : Promise.resolve(result);
  }
  maybeSingle() {
    return this.run();
  }
  single() {
    return this.run();
  }
  then<A, B>(
    onfulfilled?: ((value: Reply) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return this.run().then(onfulfilled, onrejected);
  }
}

const admin = {
  from(table: string) {
    return {
      select: () => new Query(table, "select"),
      insert: (payload: unknown) => new Query(table, "insert", payload),
      update: (payload: unknown) => new Query(table, "update", payload),
    };
  },
};

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => admin }));
vi.mock("@/lib/notifications/notify", () => ({ createNotification }));
vi.mock("@/lib/billing/usage", () => ({ checkOrgQueryCap }));
vi.mock("@/lib/leads/follow-up", () => ({ generateLeadFollowUpDraft }));
vi.mock("@/lib/observability/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { automationDispatchHandler } = await import("@/lib/automations/handler");

const EVENT = {
  id: "event-1",
  org_id: "org-1",
  lead_id: "lead-1",
  type: "lead.created",
  data: {},
};

const LEAD = {
  id: "lead-1",
  name: "Rivergate Dental",
  email: "hello@example.test",
  phone: null,
  status: "new",
};

const ACTIVE_SUB = { status: "active", tier: "pro" };

function automation(overrides: Record<string, unknown> = {}) {
  return {
    id: "auto-1",
    name: "Notify on new lead",
    trigger_type: "lead.created",
    trigger_config: {},
    action_type: "notify_team",
    action_config: {},
    ...overrides,
  };
}

/** The happy path every test starts from; individual tests override one key. */
function baseScript(over: Record<string, Reply | ((call: Call) => Reply)> = {}) {
  script = {
    lead_events: (call) =>
      call.verb === "select" ? { data: EVENT, error: null } : { data: null, error: null },
    subscriptions: { data: ACTIVE_SUB, error: null },
    // A fresh copy per read: the handler mutates its local lead after a
    // status action, and a shared fixture would leak that into the next test.
    leads: (call) =>
      call.verb === "select" ? { data: { ...LEAD }, error: null } : { data: null, error: null },
    automations: { data: [automation()], error: null },
    "automation_runs.insert": { data: { id: "run-1" }, error: null },
    "automation_runs.update": { data: null, error: null },
    memberships: { data: [{ user_id: "user-1" }, { user_id: "user-2" }], error: null },
    ...over,
  };
}

const job = (payload: Record<string, unknown> = { eventId: "event-1" }) =>
  ({ id: "job-1", type: "automation-dispatch", payload, attempts: 0 }) as never;

const runsFinishedWith = () =>
  calls
    .filter((c) => c.table === "automation_runs" && c.verb === "update")
    .map((c) => c.payload as Record<string, unknown>);

beforeEach(() => {
  calls = [];
  vi.clearAllMocks();
  checkOrgQueryCap.mockResolvedValue({ allowed: true });
  baseScript();
});

describe("automationDispatchHandler", () => {
  it("refuses a job with no event id", async () => {
    await expect(automationDispatchHandler(job({}))).rejects.toThrow(/missing eventId/);
  });

  it("no-ops when the event no longer exists", async () => {
    baseScript({ lead_events: { data: null, error: null } });
    await automationDispatchHandler(job());
    expect(calls.some((c) => c.table === "automations")).toBe(false);
  });

  it("does not run automations for an org that is not entitled", async () => {
    baseScript({ subscriptions: { data: { status: "active", tier: "starter" }, error: null } });
    await automationDispatchHandler(job());
    expect(calls.some((c) => c.table === "automations")).toBe(false);
    expect(createNotification).not.toHaveBeenCalled();
  });

  it("no-ops when the lead has been deleted", async () => {
    baseScript({
      leads: (call) => (call.verb === "select" ? { data: null, error: null } : {}),
    });
    await automationDispatchHandler(job());
    expect(calls.some((c) => c.table === "automations")).toBe(false);
  });

  it("skips an automation whose trigger does not match the event", async () => {
    baseScript({
      automations: { data: [automation({ trigger_type: "lead.status_changed" })], error: null },
    });
    await automationDispatchHandler(job());
    expect(calls.some((c) => c.table === "automation_runs")).toBe(false);
  });

  it("notifies every manager and records the count", async () => {
    await automationDispatchHandler(job());

    expect(createNotification).toHaveBeenCalledTimes(2);
    expect(createNotification.mock.calls[0]?.[1]).toMatchObject({
      orgId: "org-1",
      userId: "user-1",
      data: { leadId: "lead-1" },
    });
    expect(runsFinishedWith()[0]).toMatchObject({
      status: "succeeded",
      result: { notified: 2, email: false },
    });
  });

  it("moves the lead and writes an audit event when the status differs", async () => {
    baseScript({
      automations: {
        data: [
          automation({ action_type: "set_lead_status", action_config: { status: "contacted" } }),
        ],
        error: null,
      },
    });
    await automationDispatchHandler(job());

    const update = calls.find((c) => c.table === "leads" && c.verb === "update");
    expect(update?.payload).toMatchObject({ status: "contacted" });
    expect(update?.payload).toHaveProperty("last_contacted_at");

    const audit = calls.find((c) => c.table === "lead_events" && c.verb === "insert");
    expect(audit?.payload).toMatchObject({
      type: "automation.action",
      data: { action: "set_lead_status", from: "new", to: "contacted" },
    });
    expect(runsFinishedWith()[0]).toMatchObject({ status: "succeeded" });
  });

  it("does not touch the lead when it is already in the target status", async () => {
    baseScript({
      automations: {
        data: [automation({ action_type: "set_lead_status", action_config: { status: "new" } })],
        error: null,
      },
    });
    await automationDispatchHandler(job());

    expect(calls.some((c) => c.table === "leads" && c.verb === "update")).toBe(false);
    expect(runsFinishedWith()[0]).toMatchObject({
      status: "succeeded",
      result: { from: "new", to: "new" },
    });
  });

  it("fails the run and the job when the configured status is not a lead status", async () => {
    baseScript({
      automations: {
        data: [automation({ action_type: "set_lead_status", action_config: { status: "banana" } })],
        error: null,
      },
    });
    await expect(automationDispatchHandler(job())).rejects.toThrow(/require retry/);
    expect(runsFinishedWith()[0]).toMatchObject({
      status: "failed",
      error: "Automation has an invalid target status",
    });
  });

  it("skips a follow-up draft when the lead has no email, and spends no AI query", async () => {
    baseScript({
      automations: { data: [automation({ action_type: "draft_follow_up" })], error: null },
      leads: (call) =>
        call.verb === "select" ? { data: { ...LEAD, email: null }, error: null } : {},
    });
    await automationDispatchHandler(job());

    expect(generateLeadFollowUpDraft).not.toHaveBeenCalled();
    expect(runsFinishedWith()[0]).toMatchObject({
      status: "skipped",
      result: { reason: "lead_has_no_email" },
    });
  });

  it("skips a follow-up draft when the org is at its AI cap", async () => {
    baseScript({
      automations: { data: [automation({ action_type: "draft_follow_up" })], error: null },
    });
    checkOrgQueryCap.mockResolvedValue({ allowed: false });

    await automationDispatchHandler(job());

    expect(generateLeadFollowUpDraft).not.toHaveBeenCalled();
    expect(runsFinishedWith()[0]).toMatchObject({
      status: "skipped",
      result: { reason: "ai_usage_cap_reached" },
    });
  });

  it("drafts a follow-up when there is an email and headroom", async () => {
    baseScript({
      automations: { data: [automation({ action_type: "draft_follow_up" })], error: null },
    });
    await automationDispatchHandler(job());

    expect(generateLeadFollowUpDraft).toHaveBeenCalledWith({
      orgId: "org-1",
      leadId: "lead-1",
      userId: null,
    });
    expect(runsFinishedWith()[0]).toMatchObject({
      status: "succeeded",
      result: { drafted: true },
    });
  });

  it("fails the run on an action type it does not implement", async () => {
    baseScript({
      automations: { data: [automation({ action_type: "send_customer_email" })], error: null },
    });
    await expect(automationDispatchHandler(job())).rejects.toThrow(/require retry/);
    expect(runsFinishedWith()[0]).toMatchObject({
      status: "failed",
      error: 'Unsupported automation action "send_customer_email"',
    });
  });

  it("runs every matching automation even when one of them fails", async () => {
    baseScript({
      automations: {
        data: [
          automation({ id: "auto-bad", action_type: "nope" }),
          automation({ id: "auto-good", action_type: "notify_team" }),
        ],
        error: null,
      },
    });

    await expect(automationDispatchHandler(job())).rejects.toThrow(/1 automation run\(s\) failed/);
    expect(createNotification).toHaveBeenCalledTimes(2);
    const statuses = runsFinishedWith().map((p) => p.status);
    expect(statuses).toEqual(["failed", "succeeded"]);
  });

  it("does not re-run an automation whose run was already claimed", async () => {
    baseScript({
      "automation_runs.insert": { data: null, error: { code: "23505" } },
      "automation_runs.select": {
        data: { id: "run-1", status: "succeeded", started_at: new Date().toISOString() },
        error: null,
      },
    });
    await automationDispatchHandler(job());
    expect(createNotification).not.toHaveBeenCalled();
  });

  it("targets exactly one automation on a manual run", async () => {
    await automationDispatchHandler(
      job({ eventId: "event-1", automationId: "auto-1", manual: true }),
    );

    const query = calls.find((c) => c.table === "automations");
    expect(query?.filters).toMatchObject({ id: "auto-1" });
    expect(query?.filters).not.toHaveProperty("trigger_type");
  });
});
