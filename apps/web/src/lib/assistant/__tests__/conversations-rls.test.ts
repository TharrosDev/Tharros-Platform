import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Day 29 — conversations / messages RLS isolation harness.
 *
 * Proves the per-user + owner-sees-all visibility model: a plain member sees
 * only their own threads, the org owner sees every thread in the org (with the
 * author resolvable), cross-org is excluded, and messages inherit their parent
 * conversation's visibility. Mirrors the Day-23 documents harness: service-role
 * seeds ground truth; every assertion runs through a real user-session client so
 * the live policies are exercised. Torn down in afterAll.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY!;

const PASSWORD = "Test-Pw-Day29-aA1!";
const RUN = Date.now().toString(36);
const emailFor = (who: string) => `conv-rls-${RUN}-${who}@tharros-rls.test`;

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

async function seedConversation(orgId: string, userId: string, title: string): Promise<string> {
  const { data, error } = await admin
    .from("conversations")
    .insert({ org_id: orgId, user_id: userId, title })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

let userA = ""; // owner of org A
let userC = ""; // plain member of org A
let userB = ""; // owner of org B
let orgA = "";
let orgB = "";
let convA = ""; // owner A's thread in org A
let convC = ""; // member C's thread in org A
let convB = ""; // owner B's thread in org B

let clientA: SupabaseClient;
let clientB: SupabaseClient;
let clientC: SupabaseClient;

beforeAll(async () => {
  userA = await seedUser("a");
  userC = await seedUser("c");
  userB = await seedUser("b");

  orgA = await ownOrgId(userA);
  orgB = await ownOrgId(userB);

  const { error } = await admin
    .from("memberships")
    .insert({ user_id: userC, org_id: orgA, role: "member" });
  if (error) throw error;

  convA = await seedConversation(orgA, userA, "owner thread");
  convC = await seedConversation(orgA, userC, "member thread");
  convB = await seedConversation(orgB, userB, "other org thread");

  // A message in the member's thread, to test message inheritance.
  const { error: msgErr } = await admin.from("messages").insert({
    conversation_id: convC,
    org_id: orgA,
    role: "user",
    content: "member question",
  });
  if (msgErr) throw msgErr;

  clientA = await asUser(emailFor("a"));
  clientB = await asUser(emailFor("b"));
  clientC = await asUser(emailFor("c"));
});

afterAll(async () => {
  const ids = [userA, userC, userB].filter(Boolean);
  if (ids.length) {
    const { data: orgs } = await admin.from("memberships").select("org_id").in("user_id", ids);
    const orgIds = [...new Set((orgs ?? []).map((m) => m.org_id))];
    for (const id of orgIds) await admin.from("organizations").delete().eq("id", id);
    for (const id of ids) await admin.auth.admin.deleteUser(id);
  }
});

describe("conversations — per-user + owner visibility", () => {
  it("plain member C sees only their own thread in org A", async () => {
    const { data } = await clientC.from("conversations").select("id");
    expect(data?.map((r) => r.id)).toEqual([convC]);
  });

  it("owner A sees every thread in org A (own + member's), not org B's", async () => {
    const { data } = await clientA.from("conversations").select("id");
    const ids = new Set(data?.map((r) => r.id));
    expect(ids).toEqual(new Set([convA, convC]));
    expect(ids.has(convB)).toBe(false);
  });

  it("owner B sees only org B's thread", async () => {
    const { data } = await clientB.from("conversations").select("id");
    expect(data?.map((r) => r.id)).toEqual([convB]);
  });

  it("member C cannot read the owner's thread even by id", async () => {
    const { data } = await clientC.from("conversations").select("id").eq("id", convA);
    expect(data).toEqual([]);
  });
});

describe("conversations — write access", () => {
  it("member C can start their own thread in org A", async () => {
    const { data, error } = await clientC
      .from("conversations")
      .insert({ org_id: orgA, user_id: userC, title: "another" })
      .select("id");
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("C cannot create a thread authored by someone else", async () => {
    const { error } = await clientC
      .from("conversations")
      .insert({ org_id: orgA, user_id: userA, title: "spoof" });
    expect(error).not.toBeNull();
  });

  it("A cannot create a thread in a foreign org", async () => {
    const { error } = await clientA
      .from("conversations")
      .insert({ org_id: orgB, user_id: userA, title: "sneak" });
    expect(error).not.toBeNull();
  });
});

describe("messages — inherit conversation visibility", () => {
  it("owner A can read the member's message (owner-sees-all)", async () => {
    const { data } = await clientA.from("messages").select("id").eq("conversation_id", convC);
    expect(data?.length).toBe(1);
  });

  it("a non-member of the message's org sees nothing", async () => {
    const { data } = await clientB.from("messages").select("id").eq("conversation_id", convC);
    expect(data).toEqual([]);
  });

  it("member C can append to their own thread but not the owner's", async () => {
    const ok = await clientC
      .from("messages")
      .insert({ conversation_id: convC, org_id: orgA, role: "user", content: "hi" })
      .select("id");
    expect(ok.error).toBeNull();

    const bad = await clientC
      .from("messages")
      .insert({ conversation_id: convA, org_id: orgA, role: "user", content: "no" });
    expect(bad.error).not.toBeNull();
  });
});
