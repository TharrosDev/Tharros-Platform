import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Day 33 — ai_usage_events RLS + ai_usage_summary RPC harness. Proves the
 * org-scoped read policy and the RPC's membership guard: a member sees their
 * org's current-month rollup; a non-member gets a zero row (never another org's
 * spend). Writes go through the service-role client (the table has no user-write
 * policy). Mirrors the Day-27/32 RLS harnesses; provider-free (no Claude calls).
 *
 * Run with `pnpm --filter @tharros/web test`.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY!;

const PASSWORD = "Test-Pw-Day33-aA1!";
const RUN = Date.now().toString(36);
const emailFor = (who: string) => `usage-rls-${RUN}-${who}@tharros-rls.test`;

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

let userA = "";
let userB = "";
let orgA = "";
let orgB = "";
let clientA: SupabaseClient;

beforeAll(async () => {
  userA = await seedUser("a");
  userB = await seedUser("b");
  orgA = await ownOrgId(userA);
  orgB = await ownOrgId(userB);

  // Two opus calls + one haiku call for org A this month; one call for org B.
  await admin.from("ai_usage_events").insert([
    {
      org_id: orgA,
      user_id: userA,
      model: "claude-opus-4-8",
      input_tokens: 100,
      output_tokens: 50,
      cache_read_tokens: 10,
      cache_creation_tokens: 0,
    },
    {
      org_id: orgA,
      user_id: userA,
      model: "claude-opus-4-8",
      input_tokens: 200,
      output_tokens: 80,
      cache_read_tokens: 0,
      cache_creation_tokens: 20,
    },
    {
      org_id: orgA,
      user_id: userA,
      model: "claude-haiku-4-5",
      input_tokens: 300,
      output_tokens: 40,
      cache_read_tokens: 0,
      cache_creation_tokens: 0,
    },
    {
      org_id: orgB,
      user_id: userB,
      model: "claude-opus-4-8",
      input_tokens: 999,
      output_tokens: 999,
      cache_read_tokens: 0,
      cache_creation_tokens: 0,
    },
  ]);

  clientA = await asUser(emailFor("a"));
});

afterAll(async () => {
  for (const id of [userA, userB].filter(Boolean)) {
    const { data: m } = await admin.from("memberships").select("org_id").eq("user_id", id);
    // Deleting the org cascades to its ai_usage_events rows.
    for (const r of m ?? []) await admin.from("organizations").delete().eq("id", r.org_id);
    await admin.auth.admin.deleteUser(id);
  }
});

describe("ai_usage_events RLS", () => {
  it("lets a member read only their own org's usage rows", async () => {
    const { data, error } = await clientA.from("ai_usage_events").select("org_id");
    expect(error).toBeNull();
    expect(data).toHaveLength(3);
    expect((data ?? []).every((r) => r.org_id === orgA)).toBe(true);
  });
});

describe("ai_usage_summary RPC", () => {
  it("rolls up this month's queries + tokens for a member's org", async () => {
    const { data, error } = await clientA.rpc("ai_usage_summary", { p_org: orgA });
    expect(error).toBeNull();
    const row = data[0];
    expect(Number(row.query_count)).toBe(3);
    expect(Number(row.input_tokens)).toBe(600); // 100 + 200 + 300
    expect(Number(row.output_tokens)).toBe(170); // 50 + 80 + 40
    expect(Number(row.cache_read_tokens)).toBe(10);
    expect(Number(row.cache_creation_tokens)).toBe(20);
    expect(Number(row.by_model["claude-opus-4-8"].queryCount)).toBe(2);
    expect(Number(row.by_model["claude-haiku-4-5"].queryCount)).toBe(1);
  });

  it("returns a zero row for a non-member (never another org's spend)", async () => {
    const { data, error } = await clientA.rpc("ai_usage_summary", { p_org: orgB });
    expect(error).toBeNull();
    const row = data[0];
    expect(Number(row.query_count)).toBe(0);
    expect(Number(row.input_tokens)).toBe(0);
    expect(row.by_model).toEqual({});
  });
});
