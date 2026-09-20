import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Day 62 — org_activity_log RPC harness (live, against the CI project). Proves the
 * unified feed merges both audit trails, is owner/admin-gated (a plain member and
 * a foreign org both get nothing), and orders newest-first. agent_audit_log is
 * deny-all, so this RPC is the only way a human reads it — the gate matters.
 *
 * Mirrors the analytics harness: service-role seeds ground truth; assertions run
 * through real user-session clients. Run with `pnpm --filter @tharros/web test`.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY!;

const PASSWORD = "Test-Pw-Day62-aA1!";
const RUN = Date.now().toString(36);
const emailFor = (who: string) => `activity-${RUN}-${who}@tharros-rls.test`;

const admin = createClient(SUPABASE_URL, SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function seedUser(who: string): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email: emailFor(who),
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user.id;
}

async function asUser(email: string): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return client;
}

async function ownOrgId(userId: string): Promise<string> {
  const { data, error } = await admin
    .from("memberships")
    .select("org_id")
    .eq("user_id", userId)
    .eq("role", "owner")
    .single();
  if (error) throw error;
  return data.org_id as string;
}

let owner = "";
let member = "";
let outsider = "";
let orgA = "";
let clientOwner: SupabaseClient;
let clientMember: SupabaseClient;
let clientOutsider: SupabaseClient;

beforeAll(async () => {
  owner = await seedUser("owner");
  member = await seedUser("member");
  outsider = await seedUser("outsider");
  orgA = await ownOrgId(owner);

  // member is a plain member of org A.
  const mem = await admin
    .from("memberships")
    .insert({ user_id: member, org_id: orgA, role: "member" });
  if (mem.error) throw mem.error;

  // Seed both audit trails with controlled timestamps (newest = schedule row).
  const agent = await admin.from("agent_audit_log").insert({
    org_id: orgA,
    actor: "ai",
    action: "model_call",
    model: "deepseek-chat",
    detail: {},
    created_at: "2026-06-08T10:00:00Z",
  });
  if (agent.error) throw agent.error;

  const sched = await admin.from("scheduling_audit_log").insert({
    org_id: orgA,
    actor_type: "manager",
    action: "schedule.published",
    entity_type: "schedule",
    detail: {},
    created_at: "2026-06-08T11:00:00Z",
  });
  if (sched.error) throw sched.error;

  clientOwner = await asUser(emailFor("owner"));
  clientMember = await asUser(emailFor("member"));
  clientOutsider = await asUser(emailFor("outsider"));
}, 30_000);

afterAll(async () => {
  await admin.from("agent_audit_log").delete().eq("org_id", orgA);
  await admin.from("scheduling_audit_log").delete().eq("org_id", orgA);
  await admin.auth.admin.deleteUser(owner).catch(() => {});
  await admin.auth.admin.deleteUser(member).catch(() => {});
  await admin.auth.admin.deleteUser(outsider).catch(() => {});
});

describe("org_activity_log", () => {
  it("returns both trails merged, newest-first, for an owner", async () => {
    const { data, error } = await clientOwner.rpc("org_activity_log", { p_org: orgA, p_limit: 50 });
    expect(error).toBeNull();
    const rows = (data ?? []) as Array<{ source: string; action: string; created_at: string }>;
    expect(rows.length).toBe(2);
    // Newest (11:00 schedule) first, then the 10:00 agent row.
    expect(rows[0]).toMatchObject({ source: "schedule", action: "schedule.published" });
    expect(rows[1]).toMatchObject({ source: "agent", action: "model_call" });
  });

  it("honours the p_before keyset cursor", async () => {
    const { data } = await clientOwner.rpc("org_activity_log", {
      p_org: orgA,
      p_limit: 50,
      p_before: "2026-06-08T11:00:00Z",
    });
    const rows = (data ?? []) as Array<{ source: string }>;
    // Only the 10:00 agent row is strictly before 11:00.
    expect(rows.length).toBe(1);
    expect(rows[0].source).toBe("agent");
  });

  it("denies a plain member (agent internals are management-only)", async () => {
    const { data, error } = await clientMember.rpc("org_activity_log", {
      p_org: orgA,
      p_limit: 50,
    });
    expect(error).toBeNull();
    expect((data ?? []) as unknown[]).toHaveLength(0);
  });

  it("denies a user from another org", async () => {
    const { data, error } = await clientOutsider.rpc("org_activity_log", {
      p_org: orgA,
      p_limit: 50,
    });
    expect(error).toBeNull();
    expect((data ?? []) as unknown[]).toHaveLength(0);
  });
});

describe("member schedule-only feed (the schedule_activity variant)", () => {
  it("a plain member reads the schedule trail directly but never the agent trail", async () => {
    // The member variant reads scheduling_audit_log directly (member-read RLS) —
    // it sees schedule changes...
    const sched = await clientMember
      .from("scheduling_audit_log")
      .select("id, action")
      .eq("org_id", orgA);
    expect(sched.error).toBeNull();
    expect((sched.data ?? []).map((r) => r.action)).toContain("schedule.published");

    // ...but agent_audit_log is deny-all, so the agent half stays manager-only.
    const agent = await clientMember.from("agent_audit_log").select("id").eq("org_id", orgA);
    expect((agent.data ?? []) as unknown[]).toHaveLength(0);
  });
});
