import { getAuthUser } from "@/lib/auth/current-user";
import { getFeatureAccess } from "@/lib/billing/entitlements";
import { getOrgContext } from "@/lib/org/queries";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { chunkText } from "@/lib/documents/chunk";
import { embedTexts, toVectorLiteral } from "@/lib/documents/embeddings";
import { logger } from "@/lib/observability/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  isSameOriginMutation,
  opaqueRateLimitKey,
} from "@/lib/security/request";

// Node runtime: chunking + the embeddings fetch run server-side.
export const runtime = "nodejs";

/**
 * Day 26 — chunk + embed endpoint. Triggered by the uploader after extraction
 * succeeds (and by a future "re-index"). Authorizes via the user session (RLS
 * read), then does the work with the service-role admin client — the only writer
 * to document_chunks + ingestion_jobs (Day 23). Idempotent: clears prior chunks
 * before re-inserting, so re-running re-indexes cleanly.
 *
 * Status flow: extracted → chunking → embedding → ready (| failed).
 * Synchronous for now (small MVP corpora); a durable queue comes with scale.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  if (!isSameOriginMutation(req)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const [user, { activeOrg }, access] = await Promise.all([
    getAuthUser(),
    getOrgContext(),
    getFeatureAccess("assistant"),
  ]);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!activeOrg) {
    return Response.json({ error: "No active organization" }, { status: 403 });
  }
  if (!access.entitled) {
    return Response.json({ error: "Active plan required" }, { status: 403 });
  }

  const [userLimit, orgLimit] = await Promise.all([
    checkRateLimit(opaqueRateLimitKey("document-embed-user", activeOrg.id, user.id), 20, 3600),
    checkRateLimit(opaqueRateLimitKey("document-embed-org", activeOrg.id), 120, 3600),
  ]);
  if (!userLimit.allowed || !orgLimit.allowed) {
    return Response.json(
      { error: "Too many document processing requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("documents")
    .select("id, org_id, status, extracted_text")
    .eq("id", id)
    .eq("org_id", activeOrg.id)
    .maybeSingle();

  if (!doc) {
    return Response.json({ error: "Document not found" }, { status: 404 });
  }
  if (!doc.extracted_text || (doc.extracted_text as string).trim().length === 0) {
    return Response.json({ error: "Nothing to embed — extract text first." }, { status: 400 });
  }
  if (doc.status === "ready") {
    return Response.json({ status: "ready", skipped: true });
  }
  if (doc.status !== "extracted") {
    return Response.json(
      { error: "Document is not ready for embedding" },
      { status: doc.status === "chunking" || doc.status === "embedding" ? 409 : 400 },
    );
  }

  const admin = createAdminClient();
  const now = () => new Date().toISOString();

  // Atomically claim the extracted document so overlapping retries cannot
  // duplicate chunk deletion/provider calls.
  const { data: claimed, error: claimError } = await admin
    .from("documents")
    .update({ status: "chunking" })
    .eq("id", id)
    .eq("org_id", activeOrg.id)
    .eq("status", "extracted")
    .select("id")
    .maybeSingle();
  if (claimError) {
    logger.error("documents.embed_claim_failed", { document_id: id, err: claimError });
    return Response.json({ error: "Could not start document indexing" }, { status: 500 });
  }
  if (!claimed) {
    return Response.json({ error: "Document indexing is already in progress" }, { status: 409 });
  }

  const { data: job } = await admin
    .from("ingestion_jobs")
    .insert({ document_id: id, org_id: doc.org_id, stage: "embed", status: "running", attempts: 1 })
    .select("id")
    .single();

  async function finishJob(status: "succeeded" | "failed", error?: string) {
    if (!job) return;
    await admin
      .from("ingestion_jobs")
      .update({ status, error: error ?? null, updated_at: now() })
      .eq("id", job.id);
  }

  try {
    const chunks = chunkText(doc.extracted_text as string);
    if (chunks.length === 0) {
      throw new Error("Chunking produced no content.");
    }

    // Re-index safe: drop any existing chunks for this document first.
    await admin.from("document_chunks").delete().eq("document_id", id);

    await admin.from("documents").update({ status: "embedding" }).eq("id", id)
        .eq("org_id", activeOrg.id);
    const vectors = await embedTexts(chunks.map((c) => c.content));

    const rows = chunks.map((c, i) => ({
      document_id: id,
      org_id: doc.org_id,
      chunk_index: c.index,
      content: c.content,
      token_count: c.tokenCount,
      metadata: {},
      embedding: toVectorLiteral(vectors[i]),
    }));

    const { error: insertErr } = await admin.from("document_chunks").insert(rows);
    if (insertErr) throw new Error(insertErr.message);

    await admin
      .from("documents")
      .update({ status: "ready", error: null })
      .eq("id", id)
        .eq("org_id", activeOrg.id);
    await finishJob("succeeded");

    return Response.json({ status: "ready", chunks: chunks.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Embedding failed.";
    logger.error("documents.embed_failed", { document_id: id, err });
    await admin
      .from("documents")
      .update({ status: "failed", error: "Couldn't index this document. Please try re-indexing." })
      .eq("id", id)
        .eq("org_id", activeOrg.id);
    await finishJob("failed", message);
    return Response.json(
      { status: "failed", error: "Couldn't index this document. Please try re-indexing." },
      { status: 200 },
    );
  }
}
