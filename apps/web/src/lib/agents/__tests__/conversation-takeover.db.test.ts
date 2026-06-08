import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { HUMAN_TAKEOVER_STOP_REASON } from "@/lib/agents/present";

/**
 * Day 58 — conversation-takeover data path (the operations the Day-58 server
 * actions perform). Proves the manual-reply design end to end against the real
 * CI test project:
 *   - take_over_thread flips mode='human' (the gate the reply action requires);
 *   - a member-session client CANNOT insert an 'assistant' turn (RLS only allows
 *     role='user') — which is exactly why the action writes the manager's reply
 *     via the service-role admin client, tagged with the takeover sentinel;
 *   - that admin-written sentinel turn is then visible to the member session;
 *   - a member can flip thread status to 'closed' (resolve) and back;
 *   - release_thread returns mode='ai'.
 *
 * Mirrors the agent-threads-rls harness: service-role seeds ground truth, every
 * assertion runs through a real user-session client. Run with
 * `pnpm --filter @tharros/web test`.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY!;

const PASSWORD = "Test-Pw-Day58-aA1!";
const RUN = Date.now().toString(36);
const emailFor = (who: string) => `agent-takeover-${RUN}-${who}@tharros-rls.test`;

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
let orgId = "";
let threadId = "";
let clientOwner: SupabaseClient;

beforeAll(async () => {
  owner = await seedUser("owner");
  orgId = await ownOrgId(owner);

  const { data, error } = await admin
    .from("ai_conversation_threads")
    .insert({ org_id: orgId, kind: "sick_call", title: `takeover ${RUN}` })
    .select("id")
    .single();
  if (error) throw error;
  threadId = data.id as string;

  clientOwner = await asUser(emailFor("owner"));
}, 30_000);

afterAll(async () => {
  await admin.from("ai_conversation_threads").delete().eq("id", threadId);
  await admin.auth.admin.deleteUser(owner).catch(() => {});
});

describe("conversation takeover + manual reply", () => {
  it("take_over_thread flips the thread to mode='human'", async () => {
    const { data, error } = await clientOwner.rpc("take_over_thread", { p_thread: threadId });
    expect(error).toBeNull();
    expect(data?.mode).toBe("human");
    expect(data?.taken_over_by).toBe(owner);
  });

  it("a member-session client cannot insert an 'assistant' turn (RLS)", async () => {
    const { error } = await clientOwner.from("agent_turns").insert({
      thread_id: threadId,
      org_id: orgId,
      role: "assistant",
      content: [{ type: "text", text: "should be blocked" }],
    });
    expect(error).not.toBeNull();
  });

  it("the admin-written manager reply (sentinel) is visible to the member session", async () => {
    const { error: insErr } = await admin.from("agent_turns").insert({
      thread_id: threadId,
      org_id: orgId,
      role: "assistant",
      content: [{ type: "text", text: "I've got this one" }],
      stop_reason: HUMAN_TAKEOVER_STOP_REASON,
    });
    expect(insErr).toBeNull();

    const { data } = await clientOwner
      .from("agent_turns")
      .select("role, stop_reason")
      .eq("thread_id", threadId)
      .eq("stop_reason", HUMAN_TAKEOVER_STOP_REASON);
    expect(data?.length).toBe(1);
    expect(data?.[0]?.role).toBe("assistant");
  });

  it("a member can resolve (close) and reopen the thread", async () => {
    const close = await clientOwner
      .from("ai_conversation_threads")
      .update({ status: "closed" })
      .eq("id", threadId)
      .select("status")
      .single();
    expect(close.error).toBeNull();
    expect(close.data?.status).toBe("closed");

    const reopen = await clientOwner
      .from("ai_conversation_threads")
      .update({ status: "open" })
      .eq("id", threadId)
      .select("status")
      .single();
    expect(reopen.error).toBeNull();
    expect(reopen.data?.status).toBe("open");
  });

  it("release_thread hands the thread back to the agent (mode='ai')", async () => {
    const { data, error } = await clientOwner.rpc("release_thread", { p_thread: threadId });
    expect(error).toBeNull();
    expect(data?.mode).toBe("ai");
    expect(data?.taken_over_by).toBeNull();
  });
});
