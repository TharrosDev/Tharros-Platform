import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Day 23 — Document storage RLS isolation harness.
 *
 * Proves the documents / document_chunks / ingestion_jobs policies enforce
 * cross-org isolation and that document rows are server-reserved: authenticated
 * clients can read/delete their org rows but cannot forge new document records.
 *
 * Strategy mirrors the Day-11 harness (src/lib/supabase/__tests__/rls.test.ts):
 * the service-role client (bypasses RLS) seeds real auth users + ground-truth
 * rows; each assertion runs through a *user-session* client (publishable key) so
 * the live policies are actually exercised. Everything is torn down in afterAll.
 *
 * Integration test against the live Supabase project. Run with
 * `pnpm --filter @tharros/web test`.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY!;

const PASSWORD = "Test-Pw-Day23-aA1!";

const RUN = Date.now().toString(36);
const emailFor = (who: string) => `docs-rls-${RUN}-${who}@tharros-rls.test`;

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
  const { error } = await client.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (error) throw error;
  return client;
}

/** The org auto-provisioned for a user by the Day-10 signup trigger. */
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

/** Insert a document via service role; returns its id. */
async function seedDocument(orgId: string, name: string): Promise<string> {
  const { data, error } = await admin
    .from("documents")
    .insert({
      org_id: orgId,
      storage_path: `${orgId}/seed/${name}`,
      filename: name,
      status: "uploaded",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

let userA = "";
let userB = "";
let userC = "";
let orgA = "";
let orgB = "";
let docA = "";
let docB = "";

let clientA: SupabaseClient;
let clientB: SupabaseClient;
let clientC: SupabaseClient;

beforeAll(async () => {
  userA = await seedUser("a");
  userB = await seedUser("b");
  userC = await seedUser("c");

  orgA = await ownOrgId(userA);
  orgB = await ownOrgId(userB);

  // C is a plain member of org A — exercises the "members may upload" path.
  const { error } = await admin
    .from("memberships")
    .insert({ user_id: userC, org_id: orgA, role: "member" });
  if (error) throw error;

  docA = await seedDocument(orgA, "a.pdf");
  docB = await seedDocument(orgB, "b.pdf");

  // Seed a chunk + ingestion job per org (written by service role on Day 26).
  await admin.from("document_chunks").insert([
    { document_id: docA, org_id: orgA, chunk_index: 0, content: "a chunk" },
    { document_id: docB, org_id: orgB, chunk_index: 0, content: "b chunk" },
  ]);
  await admin.from("ingestion_jobs").insert([
    { document_id: docA, org_id: orgA, status: "queued" },
    { document_id: docB, org_id: orgB, status: "queued" },
  ]);

  clientA = await asUser(emailFor("a"));
  clientB = await asUser(emailFor("b"));
  clientC = await asUser(emailFor("c"));
});

afterAll(async () => {
  // Documents/chunks/jobs cascade from organizations; dropping the orgs (then
  // the users) cleans everything and sidesteps the last-owner guard, exactly
  // like the Day-11 harness teardown.
  const ids = [userA, userB, userC].filter(Boolean);
  if (ids.length) {
    const { data: orgs } = await admin
      .from("memberships")
      .select("org_id")
      .in("user_id", ids);
    const orgIds = [...new Set((orgs ?? []).map((m) => m.org_id))];
    for (const id of orgIds) {
      await admin.from("organizations").delete().eq("id", id);
    }
    for (const id of ids) {
      await admin.auth.admin.deleteUser(id);
    }
  }
});

describe("documents — cross-tenant isolation", () => {
  it("A sees only org A's documents; B sees only org B's", async () => {
    const { data: aDocs } = await clientA.from("documents").select("id");
    expect(aDocs?.map((d) => d.id)).toEqual([docA]);

    const { data: bDocs } = await clientB.from("documents").select("id");
    expect(bDocs?.map((d) => d.id)).toEqual([docB]);
  });

  it("A cannot read B's document even when naming its id", async () => {
    const { data } = await clientA.from("documents").select("id").eq("id", docB);
    expect(data).toEqual([]);
  });
});

describe("documents — write access", () => {
  it("owner A cannot bypass the server reservation seam", async () => {
    const { error } = await clientA.from("documents").insert({
      org_id: orgA,
      storage_path: `${orgA}/new/owner.pdf`,
      filename: "owner.pdf",
    });
    expect(error).not.toBeNull();
  });

  it("plain member C cannot bypass the server reservation seam", async () => {
    const { error } = await clientC.from("documents").insert({
      org_id: orgA,
      storage_path: `${orgA}/new/member.pdf`,
      filename: "member.pdf",
    });
    expect(error).not.toBeNull();
  });

  it("A cannot create a document in org B (foreign org)", async () => {
    const { error } = await clientA.from("documents").insert({
      org_id: orgB,
      storage_path: `${orgB}/sneak/x.pdf`,
      filename: "x.pdf",
    });
    expect(error).not.toBeNull();
  });

  it("A can delete its own org's document; B's stays invisible", async () => {
    const del = await clientA.from("documents").delete().eq("id", docB).select();
    expect(del.data).toEqual([]); // B's doc invisible to A → 0 rows
  });
});

describe("document_chunks & ingestion_jobs — member read only", () => {
  it("A sees only org A's chunks", async () => {
    const { data } = await clientA.from("document_chunks").select("org_id");
    expect(new Set(data?.map((c) => c.org_id))).toEqual(new Set([orgA]));
  });

  it("A sees only org A's ingestion jobs", async () => {
    const { data } = await clientA.from("ingestion_jobs").select("org_id");
    expect(new Set(data?.map((j) => j.org_id))).toEqual(new Set([orgA]));
  });

  it("A cannot insert a chunk (no client write policy)", async () => {
    const { error } = await clientA
      .from("document_chunks")
      .insert({ document_id: docA, org_id: orgA, chunk_index: 99, content: "x" });
    expect(error).not.toBeNull();
  });

  it("A cannot insert an ingestion job (no client write policy)", async () => {
    const { error } = await clientA
      .from("ingestion_jobs")
      .insert({ document_id: docA, org_id: orgA, status: "queued" });
    expect(error).not.toBeNull();
  });
});
