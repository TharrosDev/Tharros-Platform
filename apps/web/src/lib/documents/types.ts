/**
 * Day 23 — Document storage + model types.
 *
 * Mirror the public.documents / document_chunks / ingestion_jobs schema. The
 * Supabase clients are untyped in this repo, so these are the hand-maintained
 * source of truth for the documents seam (used by Day 24 upload UI + Day 26
 * ingestion job). The status unions match the DB CHECK constraints exactly.
 */

/** Private Storage bucket holding the raw uploaded bytes. */
export const DOCUMENTS_BUCKET = "documents";

/** Pipeline status on `documents` (matches the CHECK constraint).
 * Lifecycle: uploaded → extracting → extracted | needs_ocr | failed;
 * Day 26 then drives extracted → chunking → embedding → ready. */
export type DocumentStatus =
  | "uploaded"
  | "extracting"
  | "extracted"
  | "chunking"
  | "embedding"
  | "ready"
  | "needs_ocr"
  | "failed";

/** Status on `ingestion_jobs` (matches the CHECK constraint). */
export type IngestionJobStatus = "queued" | "running" | "succeeded" | "failed";

export type Document = {
  id: string;
  orgId: string;
  uploadedBy: string | null;
  storagePath: string;
  filename: string;
  mimeType: string | null;
  sizeBytes: number | null;
  status: DocumentStatus;
  error: string | null;
  createdAt: string; // ISO
};

export type DocumentChunk = {
  id: string;
  documentId: string;
  orgId: string;
  chunkIndex: number;
  content: string;
  tokenCount: number | null;
  metadata: Record<string, unknown>;
  // `embedding` (vector(1536)) is intentionally omitted from the read shape —
  // it is written by the Day-26 ingestion job and queried server-side on Day 27.
  createdAt: string; // ISO
};

export type IngestionJob = {
  id: string;
  documentId: string;
  orgId: string;
  status: IngestionJobStatus;
  stage: string | null;
  attempts: number;
  error: string | null;
  createdAt: string; // ISO
  updatedAt: string; // ISO
};

/**
 * Canonical Storage object path for a document's bytes. The first segment MUST
 * be the org_id — the storage.objects RLS policy scopes access by
 * `(storage.foldername(name))[1]::uuid in current_user_orgs()`.
 */
export function storagePathFor(
  orgId: string,
  documentId: string,
  filename: string,
): string {
  return `${orgId}/${documentId}/${filename}`;
}
