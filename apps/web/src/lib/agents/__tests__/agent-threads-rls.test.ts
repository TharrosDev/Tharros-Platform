import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Day 39 — agent threads / turns RLS + takeover-RPC harness.
 *
 * Proves the org-wide visibility model for operational agent threads (unlike the
 * author-private Day-29 conversations): every org member sees the org's threads,
 * cross-org is excluded, turns inherit the parent thread's visibility, only a
 * member may post a 'user' turn, and the take_over_thread / release_thread RPCs
 * flip the manager-takeover state for a member but reject a non-member. Mirrors
 * the conversations-rls harness: service-role seeds ground truth; every assertion
 * runs through a real user-session client. Torn down in afterAll.
 *
 * Run with `pnpm --filter @tharros/web test`.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY!;

const PASSWORD = "Test-Pw-Day39-aA1!";
const RUN = Date.now().toString(36);
const emailFor = (who: string) => `agent-rls-${RUN}-${who}@tharros-rls.test`;

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

async function seedThread(orgId: string, createdBy: string | null): Promise<string> {
  const { data, error } = await admin
    .from("ai_conversation_threads")
    .insert({ org_id: orgId, created_by: createdBy, title: `thread ${RUN}` })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

let userA = ""; // owner of org A
let userC = ""; // plain member of org A
let userB = ""; // owner of org B (unrelated)
let orgA = "";
let orgB = "";
let threadA = ""; // a thread in org A
let turnA = ""; // an assistant turn in threadA

let clientA: SupabaseClient;
let clientB: SupabaseClient;
let clientC: SupabaseClient;

beforeAll(async () => {
  userA = await seedUser("ownerA");
  userC = await seedUser("memberC");
  userB = await seedUser("ownerB");

  orgA = await ownOrgId(userA);
  orgB = await ownOrgId(userB);

  // userC is a plain member of org A.
  const { error: memErr } = await admin
    .from("memberships")
    .insert({ user_id: userC, org_id: orgA, role: "member" });
  if (memErr) throw memErr;

  threadA = await seedThread(orgA, userA);

  const { data: turn, error: turnErr } = await admin
    .from("agent_turns")
    .insert({
      thread_id: threadA,
      org_id: orgA,
      role: "assistant",
      content: [{ type: "text", text: "hi" }],
    })
    .select("id")
    .single();
  if (turnErr) throw turnErr;
  turnA = turn.id as string;

  clientA = await asUser(emailFor("ownerA"));
  clientB = await asUser(emailFor("ownerB"));
  clientC = await asUser(emailFor("memberC"));
}, 30_000);

afterAll(async () => {
  await admin.from("ai_conversation_threads").delete().eq("id", threadA);
  await admin.auth.admin.deleteUser(userA).catch(() => {});
  await admin.auth.admin.deleteUser(userB).catch(() => {});
  await admin.auth.admin.deleteUser(userC).catch(() => {});
});

describe("ai_conversation_threads RLS", () => {
  it("an org member (owner) sees the org's thread", async () => {
    const { data } = await clientA.from("ai_conversation_threads").select("id").eq("id", threadA);
    expect(data?.map((r) => r.id)).toContain(threadA);
  });

  it("a plain member of the org also sees the thread (org-wide visibility)", async () => {
    const { data } = await clientC.from("ai_conversation_threads").select("id").eq("id", threadA);
    expect(data?.map((r) => r.id)).toContain(threadA);
  });

  it("a user from another org cannot see the thread", async () => {
    const { data } = await clientB.from("ai_conversation_threads").select("id").eq("id", threadA);
    expect(data ?? []).toHaveLength(0);
  });
});

describe("agent_turns RLS (inherit parent thread visibility)", () => {
  it("an org member sees the thread's turns", async () => {
    const { data } = await clientC.from("agent_turns").select("id").eq("id", turnA);
    expect(data?.map((r) => r.id)).toContain(turnA);
  });

  it("a non-member sees none of the thread's turns", async () => {
    const { data } = await clientB.from("agent_turns").select("id").eq("id", turnA);
    expect(data ?? []).toHaveLength(0);
  });

  it("a member may insert a 'user' turn; a non-member cannot", async () => {
    const ok = await clientC
      .from("agent_turns")
      .insert({ thread_id: threadA, org_id: orgA, role: "user", content: [{ type: "text", text: "q" }] })
      .select("id")
      .single();
    expect(ok.error).toBeNull();

    const denied = await clientB
      .from("agent_turns")
      .insert({ thread_id: threadA, org_id: orgA, role: "user", content: [{ type: "text", text: "x" }] })
      .select("id")
      .single();
    expect(denied.error).not.toBeNull();
  });
});

describe("manager-takeover RPCs", () => {
  it("a member can take over and release a thread", async () => {
    const taken = await clientC.rpc("take_over_thread", { p_thread: threadA });
    expect(taken.error).toBeNull();
    expect(taken.data?.mode).toBe("human");
    expect(taken.data?.taken_over_by).toBe(userC);

    const released = await clientC.rpc("release_thread", { p_thread: threadA });
    expect(released.error).toBeNull();
    expect(released.data?.mode).toBe("ai");
    expect(released.data?.taken_over_by).toBeNull();
  });

  it("a non-member cannot take over the thread", async () => {
    const { error } = await clientB.rpc("take_over_thread", { p_thread: threadA });
    expect(error).not.toBeNull();

    // State unchanged (still ai) as seen by the admin client.
    const { data } = await admin
      .from("ai_conversation_threads")
      .select("mode")
      .eq("id", threadA)
      .single();
    expect(data?.mode).toBe("ai");
  });
});
