import { getAuthUser } from "@/lib/auth/current-user";
import { getFeatureAccess } from "@/lib/billing/entitlements";
import { getOrgContext } from "@/lib/org/queries";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CHEAP_MODEL } from "@/lib/anthropic/client";
import { checkQueryCap, recordUsage } from "@/lib/billing/usage";
import { extractText } from "@/lib/documents/extract";
import { OCR_MAX_PAGES, ocrDocument } from "@/lib/documents/ocr";
import { DOCUMENTS_BUCKET } from "@/lib/documents/types";
import { logger } from "@/lib/observability/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { isSameOriginMutation, opaqueRateLimitKey } from "@/lib/security/request";

// Node runtime: the PDF/DOCX parsers (unpdf/mammoth) need Node, not Edge.
export const runtime = "nodejs";
// Scanned PDFs / images are OCR'd inline by Claude, which can take minutes.
export const maxDuration = 300;

/**
 * Day 25 — text extraction endpoint. The uploader POSTs here right after a
 * successful Storage upload. Authorizes via the user session (RLS read), then
 * does the work with the service-role admin client (the only writer to
 * `ingestion_jobs`, and the downloader of the private bucket bytes) — mirroring
 * the Day-18 webhook pattern. Runs synchronously for now; Day 26 moves the heavy
 * lifting to a real queue.
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
    checkRateLimit(opaqueRateLimitKey("document-extract-user", activeOrg.id, user.id), 20, 3600, {
      failOpen: false,
    }),
    checkRateLimit(opaqueRateLimitKey("document-extract-org", activeOrg.id), 120, 3600, {
      failOpen: false,
    }),
  ]);
  if (!userLimit.allowed || !orgLimit.allowed) {
    return Response.json(
      { error: "Too many document processing requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  // RLS scopes this read to the caller's active org — proves membership + gets the path.
  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("documents")
    .select("id, org_id, storage_path, filename, mime_type, status")
    .eq("id", id)
    .eq("org_id", activeOrg.id)
    .maybeSingle();

  if (!doc) {
    return Response.json({ error: "Document not found" }, { status: 404 });
  }
  // Already extracted → let the caller advance to embedding. A `needs_ocr` doc
  // may be re-POSTed to retry OCR. An in-flight stage must never be reclaimed
  // by an overlapping browser retry.
  if (doc.status === "extracted") {
    return Response.json({ status: doc.status, skipped: true });
  }
  if (doc.status === "extracting" || doc.status === "chunking" || doc.status === "embedding") {
    return Response.json({ error: "Document processing is already in progress" }, { status: 409 });
  }

  const admin = createAdminClient();
  const now = () => new Date().toISOString();

  const { data: claimed, error: claimError } = await admin
    .from("documents")
    .update({ status: "extracting" })
    .eq("id", id)
    .eq("org_id", activeOrg.id)
    .eq("status", doc.status)
    .select("id")
    .maybeSingle();
  if (claimError) {
    logger.error("documents.extract_claim_failed", { document_id: id, err: claimError });
    return Response.json({ error: "Could not start document processing" }, { status: 500 });
  }
  if (!claimed) {
    return Response.json({ error: "Document processing is already in progress" }, { status: 409 });
  }
  const { data: job } = await admin
    .from("ingestion_jobs")
    .insert({
      document_id: id,
      org_id: doc.org_id,
      stage: "extract",
      status: "running",
      attempts: 1,
    })
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
    const { data: blob, error: dlErr } = await admin.storage
      .from(DOCUMENTS_BUCKET)
      .download(doc.storage_path as string);
    if (dlErr || !blob) {
      throw new Error(dlErr?.message ?? "Could not read the uploaded file.");
    }

    const bytes = await blob.arrayBuffer();
    const result = await extractText({
      bytes,
      filename: doc.filename as string,
      mimeType: (doc.mime_type as string | null) ?? undefined,
    });

    if (result.needsOcr) {
      // OCR is AI work, so it's metered (one query) and blocked at the plan cap.
      const tooLong = (result.pageCount ?? 1) > OCR_MAX_PAGES;
      const cap = tooLong ? null : await checkQueryCap(activeOrg.id);
      const ocr = cap?.allowed ? await ocrDocument(bytes, doc.filename as string) : null;
      if (ocr?.usage) await recordUsage(activeOrg.id, user.id, CHEAP_MODEL, ocr.usage);

      if (!ocr?.text) {
        const ocrError = tooLong
          ? `This scan is longer than ${OCR_MAX_PAGES} pages. Split it into smaller files to read it.`
          : cap && !cap.allowed
            ? "This month's AI query limit is reached, so this scan couldn't be read."
            : "Couldn't read the text in this file.";
        await admin
          .from("documents")
          .update({
            status: "needs_ocr",
            char_count: result.charCount,
            page_count: result.pageCount,
            extracted_at: now(),
            error: ocrError,
          })
          .eq("id", id)
          .eq("org_id", activeOrg.id);
        await finishJob("succeeded");
        return Response.json({ status: "needs_ocr", error: ocrError });
      }
      result.text = ocr.text;
      result.charCount = ocr.text.length;
    }

    await admin
      .from("documents")
      .update({
        status: "extracted",
        extracted_text: result.text,
        char_count: result.charCount,
        page_count: result.pageCount,
        extracted_at: now(),
        error: null,
      })
      .eq("id", id)
      .eq("org_id", activeOrg.id);
    await finishJob("succeeded");
    return Response.json({
      status: "extracted",
      charCount: result.charCount,
      pageCount: result.pageCount,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Extraction failed.";
    logger.error("documents.extract_failed", { document_id: id, err });
    await admin
      .from("documents")
      .update({
        status: "failed",
        error: "Couldn't read this file. Try re-uploading or a different format.",
      })
      .eq("id", id)
      .eq("org_id", activeOrg.id);
    await finishJob("failed", message);
    return Response.json(
      {
        status: "failed",
        error: "Couldn't read this file. Try re-uploading or a different format.",
      },
      { status: 200 },
    );
  }
}
