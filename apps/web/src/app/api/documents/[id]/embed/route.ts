import { getAuthUser } from "@/lib/auth/current-user";
import { getFeatureAccess } from "@/lib/billing/entitlements";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { chunkText } from "@/lib/documents/chunk";
import { embedTexts, toVectorLiteral } from "@/lib/documents/embeddings";
import { logger } from "@/lib/observability/logger";

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
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  const [user, access] = await Promise.all([
    getAuthUser(),
    getFeatureAccess("assistant"),
  ]);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!access.entitled) {
    return Response.json({ error: "Active plan required" }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("documents")
    .select("id, org_id, status, extracted_text")
    .eq("id", id)
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

  const admin = createAdminClient();
  const now = () => new Date().toISOString();

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
    await admin.from("documents").update({ status: "chunking" }).eq("id", id);

    const chunks = chunkText(doc.extracted_text as string);
    if (chunks.length === 0) {
      throw new Error("Chunking produced no content.");
    }

    // Re-index safe: drop any existing chunks for this document first.
    await admin.from("document_chunks").delete().eq("document_id", id);

    await admin.from("documents").update({ status: "embedding" }).eq("id", id);
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
      .eq("id", id);
    await finishJob("succeeded");

    return Response.json({ status: "ready", chunks: chunks.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Embedding failed.";
    logger.error("documents.embed_failed", { document_id: id, err });
    await admin
      .from("documents")
      .update({ status: "failed", error: "Couldn't index this document. Please try re-indexing." })
      .eq("id", id);
    await finishJob("failed", message);
    return Response.json({ status: "failed", error: message }, { status: 200 });
  }
}
