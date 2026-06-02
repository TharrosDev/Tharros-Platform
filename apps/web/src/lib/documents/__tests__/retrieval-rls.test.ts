import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Day 27 — match_document_chunks RPC harness. Proves org-scoped top-k retrieval:
 * results are ordered by cosine similarity, restricted to orgs the caller belongs
 * to, and an optional document filter works. Uses crafted unit vectors (no
 * OpenAI) so it runs in CI against the test Supabase project.
 *
 * Strategy mirrors the Day-11/23 harnesses: service-role seeds users + chunks;
 * assertions run through a user-session client so the RPC's membership guard
 * (current_user_orgs) is exercised for real.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY!;

const PASSWORD = "Test-Pw-Day27-aA1!";
const RUN = Date.now().toString(36);
const emailFor = (who: string) => `match-rls-${RUN}-${who}@tharros-rls.test`;

const admin = createClient(SUPABASE_URL, SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** 1536-dim unit vector with 1.0 at `axis`, as the pgvector literal string. */
function unitVecLiteral(axis: number): string {
  const v = new Array(1536).fill(0);
  v[axis] = 1;
  return `[${v.join(",")}]`;
}

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

async function seedDoc(orgId: string, name: string): Promise<string> {
  const { data, error } = await admin
    .from("documents")
    .insert({ org_id: orgId, storage_path: `${orgId}/seed/${name}`, filename: name, status: "ready" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

let userA = "";
let userB = "";
let orgA = "";
let orgB = "";
let docA1 = "";
let docA2 = "";
let clientA: SupabaseClient;

beforeAll(async () => {
  userA = await seedUser("a");
  userB = await seedUser("b");
  orgA = await ownOrgId(userA);
  orgB = await ownOrgId(userB);

  docA1 = await seedDoc(orgA, "a1.txt");
  docA2 = await seedDoc(orgA, "a2.txt");
  const docB = await seedDoc(orgB, "b.txt");

  // org A: chunk aligned with axis 0 (will match the query) + one on axis 1.
  // org B: also aligned with axis 0 — must NOT appear for user A.
  await admin.from("document_chunks").insert([
    { document_id: docA1, org_id: orgA, chunk_index: 0, content: "A-near (axis0)", embedding: unitVecLiteral(0) },
    { document_id: docA2, org_id: orgA, chunk_index: 0, content: "A-far (axis1)", embedding: unitVecLiteral(1) },
    { document_id: docB, org_id: orgB, chunk_index: 0, content: "B-near (axis0)", embedding: unitVecLiteral(0) },
  ]);

  clientA = await asUser(emailFor("a"));
});

afterAll(async () => {
  for (const id of [userA, userB].filter(Boolean)) {
    const { data: m } = await admin.from("memberships").select("org_id").eq("user_id", id);
    for (const r of m ?? []) await admin.from("organizations").delete().eq("id", r.org_id);
    await admin.auth.admin.deleteUser(id);
  }
});

describe("match_document_chunks", () => {
  it("returns org A's chunks ranked by similarity (nearest first)", async () => {
    const { data, error } = await clientA.rpc("match_document_chunks", {
      query_embedding: unitVecLiteral(0),
      p_org: orgA,
      match_count: 10,
    });
    expect(error).toBeNull();
    expect(data).toHaveLength(2); // both org-A chunks, org-B excluded
    expect(data[0].content).toContain("A-near");
    expect(data[0].similarity).toBeGreaterThan(0.99); // identical vector
    expect(data[1].content).toContain("A-far");
    expect(data[0].similarity).toBeGreaterThan(data[1].similarity);
  });

  it("never returns another org's chunks, even when asked for that org", async () => {
    const { data } = await clientA.rpc("match_document_chunks", {
      query_embedding: unitVecLiteral(0),
      p_org: orgB, // user A is not a member → membership guard yields nothing
      match_count: 10,
    });
    expect(data).toEqual([]);
  });

  it("respects match_count", async () => {
    const { data } = await clientA.rpc("match_document_chunks", {
      query_embedding: unitVecLiteral(0),
      p_org: orgA,
      match_count: 1,
    });
    expect(data).toHaveLength(1);
    expect(data[0].content).toContain("A-near");
  });

  it("filters to a single document when p_document_id is given", async () => {
    const { data } = await clientA.rpc("match_document_chunks", {
      query_embedding: unitVecLiteral(0),
      p_org: orgA,
      match_count: 10,
      p_document_id: docA2,
    });
    expect(data).toHaveLength(1);
    expect(data[0].document_id).toBe(docA2);
  });
});
