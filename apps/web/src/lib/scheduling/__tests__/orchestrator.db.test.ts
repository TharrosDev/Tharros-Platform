import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Day 48 — persistence contract for the optimize-loop's audit trail.
 *
 * The orchestrate-handler is `server-only` (it can't be imported under Vitest), so
 * this asserts the contract it depends on against the real CI Supabase project:
 *   - `ai_conversation_threads` accepts a `kind='schedule_opt'` thread (free-text
 *     kind → no migration needed) and a member reads it (org-wide readable).
 *   - `agent_audit_log` accepts the Day-48 free-text actions and stays deny-all
 *     (the service-role admin writes; a signed-in user reads zero rows).
 * Provider-free. Run with `pnpm --filter @tharros/web test`.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY!;

const PASSWORD = "Test-Pw-Day48-aA1!";
const RUN = Date.now().toString(36);
const email = `sched-opt-${RUN}@tharros-rls.test`;

const OPTIMIZE_ACTIONS = [
  "optimize_started",
  "solve_attempt",
  "remedy_applied",
  "escalation_emitted",
  "optimize_completed",
];

const admin = createClient(SUPABASE_URL, SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let userId = "";
let orgId = "";
let threadId = "";
let userClient: SupabaseClient;

beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  userId = data.user.id;

  const { data: mem, error: memErr } = await admin
    .from("memberships")
    .select("org_id")
    .eq("user_id", userId)
    .eq("role", "owner")
    .single();
  if (memErr) throw memErr;
  orgId = mem.org_id as string;

  // The handler opens a schedule_opt thread, then audit-logs each loop step.
  const { data: thread, error: threadErr } = await admin
    .from("ai_conversation_threads")
    .insert({
      org_id: orgId,
      created_by: userId,
      kind: "schedule_opt",
      title: `Schedule optimization run ${RUN}`,
    })
    .select("id")
    .single();
  if (threadErr) throw threadErr;
  threadId = thread.id as string;

  const { error: auditErr } = await admin.from("agent_audit_log").insert(
    OPTIMIZE_ACTIONS.map((action) => ({
      org_id: orgId,
      thread_id: threadId,
      actor: "system",
      action,
      detail: { run: RUN },
    })),
  );
  if (auditErr) throw auditErr;

  userClient = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInErr } = await userClient.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInErr) throw signInErr;
}, 30_000);

afterAll(async () => {
  await admin.from("agent_audit_log").delete().eq("thread_id", threadId);
  await admin.from("ai_conversation_threads").delete().eq("id", threadId);
  await admin.auth.admin.deleteUser(userId).catch(() => {});
});

describe("schedule_opt thread + optimize audit trail", () => {
  it("stores a schedule_opt thread the org member can read", async () => {
    const { data } = await userClient
      .from("ai_conversation_threads")
      .select("id, kind")
      .eq("id", threadId)
      .single();
    expect(data?.kind).toBe("schedule_opt");
  });

  it("records every optimize-loop step (free-text actions accepted)", async () => {
    const { data } = await admin
      .from("agent_audit_log")
      .select("action")
      .eq("thread_id", threadId);
    const actions = (data ?? []).map((r) => r.action as string).sort();
    expect(actions).toEqual([...OPTIMIZE_ACTIONS].sort());
  });

  it("keeps the audit trail deny-all for signed-in users", async () => {
    const { data } = await userClient.from("agent_audit_log").select("id").eq("thread_id", threadId);
    expect(data ?? []).toHaveLength(0);
  });
});
