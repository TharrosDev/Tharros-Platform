import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Day 22 — E2E service-role helpers.
 *
 * Mirrors the Vitest harness convention in lib/<domain>/__tests__: a service-role
 * client that bypasses RLS to seed fixtures and read ground truth against the
 * dedicated TEST Supabase project (never prod). Kept out of app code — the app
 * never imports `e2e/`.
 *
 * The subscription helper writes `public.subscriptions` directly (service role).
 * In production that table's only writer is the Day-18 webhook; here we seed the
 * same shape it would persist, which is all the Day-19 gate reads — giving the
 * spine a deterministic gated→active→canceled transition without driving the
 * flaky Stripe Checkout iframe.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY!;

/** Shared password for every seeded/signed-up E2E user. */
export const E2E_PASSWORD = "Test-Pw-Day22-aA1!";

export const admin: SupabaseClient = createClient(SUPABASE_URL, SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** A unique, identifiable email per run so a crash leaves traceable rows. */
export function emailFor(run: string, who: string): string {
  return `e2e-${run}-${who}@tharros-e2e.test`;
}

/** Create an already email-confirmed user (for the invitee / secondary actors). */
export async function createConfirmedUser(email: string): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: E2E_PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user.id;
}

/** The personal org auto-provisioned for a user by the Day-10 signup trigger. */
export async function ownOrgId(userId: string): Promise<string> {
  const { data, error } = await admin
    .from("memberships")
    .select("org_id")
    .eq("user_id", userId)
    .eq("role", "owner")
    .single();
  if (error) throw error;
  return (data as { org_id: string }).org_id;
}

/** The live (unaccepted, unrevoked) invite token for an (org, email). */
export async function inviteTokenFor(orgId: string, email: string): Promise<string> {
  const { data, error } = await admin
    .from("invites")
    .select("token")
    .eq("org_id", orgId)
    .eq("email", email.toLowerCase())
    .is("accepted_at", null)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (error) throw error;
  return (data as { token: string }).token;
}

/** Whether a user is currently a member of an org (proves an invite was accepted). */
export async function isMember(orgId: string, userId: string): Promise<boolean> {
  const { count } = await admin
    .from("memberships")
    .select("user_id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("user_id", userId);
  return (count ?? 0) > 0;
}

export type SeedStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "paused";

/**
 * Seed/overwrite the org's subscription row to a given status — the same shape
 * the Day-18 webhook persists. Used to flip the Day-19 gate deterministically.
 */
export async function setSubscription(
  orgId: string,
  status: SeedStatus,
  tier: "starter" | "growth" | "pro" = "growth",
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const { error } = await admin.from("subscriptions").upsert(
    {
      org_id: orgId,
      stripe_subscription_id: `sub_e2e_${orgId}`,
      stripe_customer_id: `cus_e2e_${orgId}`,
      status,
      tier,
      price_id: "price_e2e",
      current_period_end: new Date((now + 30 * 86_400) * 1000).toISOString(),
      cancel_at_period_end: false,
      trial_ends_at: null,
    },
    { onConflict: "org_id" },
  );
  if (error) throw error;
}

/**
 * Mark an org onboarded so the (app) layout stops bouncing the owner to the
 * first-run wizard. The layout's gate is purely `onboarded_at !== null`
 * (lib/org/queries `getOrgContext`), so this one field is all the assistant
 * spine needs — the wizard itself is already covered by the Day-22 spine.
 */
export async function onboardOrg(orgId: string): Promise<void> {
  const { error } = await admin
    .from("organizations")
    .update({ onboarded_at: new Date().toISOString() })
    .eq("id", orgId);
  if (error) throw error;
}

/**
 * Seed a `documents` row already at `status: 'ready'` — the shape the Day-25/26
 * ingestion pipeline lands on — so `hasAnyDocument` is true and `/knowledge`
 * shows a Ready row without running the (keyed) extract→embed routes. Optionally
 * seeds one crafted-vector `document_chunks` row (the Day-27 unitVecLiteral
 * trick) so the doc is even retrievable; not load-bearing for the deterministic
 * core. Returns the document id.
 */
export async function createReadyDocument(
  orgId: string,
  filename: string,
  opts: { withChunk?: boolean } = {},
): Promise<string> {
  const { data, error } = await admin
    .from("documents")
    .insert({
      org_id: orgId,
      storage_path: `${orgId}/seed/${filename}`,
      filename,
      mime_type: "text/plain",
      size_bytes: 1024,
      status: "ready",
    })
    .select("id")
    .single();
  if (error) throw error;
  const documentId = (data as { id: string }).id;

  if (opts.withChunk) {
    const v = new Array(1536).fill(0);
    v[0] = 1;
    const { error: chunkErr } = await admin.from("document_chunks").insert({
      document_id: documentId,
      org_id: orgId,
      chunk_index: 0,
      content: `Seeded content for ${filename}.`,
      token_count: 8,
      embedding: `[${v.join(",")}]`,
    });
    if (chunkErr) throw chunkErr;
  }
  return documentId;
}

/**
 * Seed a conversation with one user turn + one cited assistant turn — exactly
 * what `/api/assistant/query` persists after a grounded answer. Lets the spine
 * assert the thread + the "Based on N documents" citation footer render without
 * a Claude call. `citations` is the Day-28 `Citation[]` (camelCase jsonb keys:
 * documentId / filename / index / chunkIndices). Returns the conversation id.
 */
export async function seedConversationWithCitedAnswer(
  orgId: string,
  userId: string,
  args: {
    question: string;
    answer: string;
    citation: { documentId: string; filename: string };
  },
): Promise<string> {
  const { data: conv, error: convErr } = await admin
    .from("conversations")
    .insert({ org_id: orgId, user_id: userId, title: args.question.slice(0, 80) })
    .select("id")
    .single();
  if (convErr) throw convErr;
  const conversationId = (conv as { id: string }).id;

  const { error: msgErr } = await admin.from("messages").insert([
    {
      conversation_id: conversationId,
      org_id: orgId,
      role: "user",
      content: args.question,
      // Explicit [] — in a bulk insert PostgREST fills keys absent from one row
      // with NULL (not the column default), which violates citations NOT NULL.
      citations: [],
    },
    {
      conversation_id: conversationId,
      org_id: orgId,
      role: "assistant",
      content: args.answer,
      citations: [
        {
          index: 1,
          documentId: args.citation.documentId,
          filename: args.citation.filename,
          chunkIndices: [0],
        },
      ],
    },
  ]);
  if (msgErr) throw msgErr;
  return conversationId;
}

/** Poll a document's pipeline status (used by the keyed live tail). */
export async function documentStatus(documentId: string): Promise<string | null> {
  const { data } = await admin
    .from("documents")
    .select("status")
    .eq("id", documentId)
    .maybeSingle();
  return (data as { status: string } | null)?.status ?? null;
}

/** The most recently created document id for an org (live tail reads its status). */
export async function latestDocumentId(orgId: string): Promise<string | null> {
  const { data } = await admin
    .from("documents")
    .select("id")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

/**
 * Tear down seeded users: delete their orgs first (cascade clears memberships /
 * org_settings / subscriptions / invites / documents / document_chunks /
 * conversations / messages; cascade also skips the last-owner guard), then the
 * auth users. Mirrors the Vitest harness afterAll.
 */
export async function cleanup(userIds: string[]): Promise<void> {
  const ids = userIds.filter(Boolean);
  if (!ids.length) return;

  const { data: orgs } = await admin
    .from("memberships")
    .select("org_id")
    .in("user_id", ids);
  const orgIds = [...new Set((orgs ?? []).map((m) => (m as { org_id: string }).org_id))];
  for (const id of orgIds) {
    await admin.from("organizations").delete().eq("id", id);
  }
  for (const id of ids) {
    await admin.auth.admin.deleteUser(id);
  }
}
