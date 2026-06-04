import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Day 39 — agent_audit_log deny-all RLS harness. The audit trail is service-role
 * only (no policies), exactly like jobs / stripe_events: the admin client writes,
 * a signed-in user reads zero rows and cannot write. Provider-free.
 *
 * Run with `pnpm --filter @tharros/web test`.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY!;

const PASSWORD = "Test-Pw-Day39b-aA1!";
const RUN = Date.now().toString(36);
const email = `agent-audit-${RUN}@tharros-rls.test`;

const admin = createClient(SUPABASE_URL, SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let userId = "";
let orgId = "";
let auditId = "";
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

  const { data: row, error: insErr } = await admin
    .from("agent_audit_log")
    .insert({ org_id: orgId, actor: "ai", action: "turn_started", detail: { run: RUN } })
    .select("id")
    .single();
  if (insErr) throw insErr;
  auditId = row.id as string;

  userClient = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInErr } = await userClient.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInErr) throw signInErr;
}, 30_000);

afterAll(async () => {
  await admin.from("agent_audit_log").delete().eq("id", auditId);
  await admin.auth.admin.deleteUser(userId).catch(() => {});
});

describe("agent_audit_log deny-all RLS", () => {
  it("the service-role client can write and read the audit row", async () => {
    const { data } = await admin.from("agent_audit_log").select("id, action").eq("id", auditId).single();
    expect(data?.action).toBe("turn_started");
  });

  it("a signed-in user reads zero audit rows (deny-all)", async () => {
    const { data } = await userClient.from("agent_audit_log").select("id").eq("id", auditId);
    expect(data ?? []).toHaveLength(0);
  });

  it("a signed-in user cannot insert an audit row", async () => {
    const { error } = await userClient
      .from("agent_audit_log")
      .insert({ org_id: orgId, actor: "human", action: "tamper" })
      .select("id")
      .single();
    expect(error).not.toBeNull();
  });
});
