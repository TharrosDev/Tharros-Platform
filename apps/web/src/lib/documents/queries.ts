import "server-only";

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/observability/logger";
import { PAGE_SIZE, decodeCursor, nextCursorFrom } from "@/lib/pagination";
import type { Document, DocumentStatus } from "@/lib/documents/types";

/**
 * Day 23 — read-side document data for the org library (Day 24 UI consumes this).
 * Reads go through the SSR user-session client so RLS scopes every row to the
 * caller's orgs. The list is keyset-paginated + server-side searched via the
 * `search_documents` RPC (membership-enforced, newest-first) so a busy library
 * never ships every row to the client. Citation usage is denormalized onto the
 * row (`cited_count`/`last_cited_at`, kept current by a trigger) — no more
 * per-load org-wide scan of message citations.
 */

// Shape of the PostgREST / RPC row (clients are untyped in this repo).
type DocumentRow = {
  id: string;
  org_id: string;
  uploaded_by: string | null;
  storage_path: string;
  filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  status: DocumentStatus;
  error: string | null;
  tags: string[] | null;
  cited_count: number | null;
  last_cited_at: string | null;
  created_at: string;
};

function mapDocument(row: DocumentRow): Document {
  return {
    id: row.id,
    orgId: row.org_id,
    uploadedBy: row.uploaded_by,
    storagePath: row.storage_path,
    filename: row.filename,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    status: row.status,
    error: row.error,
    tags: row.tags ?? [],
    citedCount: Number(row.cited_count ?? 0),
    lastCitedAt: row.last_cited_at,
    createdAt: row.created_at,
  };
}

const DOCUMENT_COLUMNS =
  "id, org_id, uploaded_by, storage_path, filename, mime_type, size_bytes, status, error, tags, cited_count, last_cited_at, created_at";

export type DocumentPage = { documents: Document[]; nextCursor: string | null };

/**
 * One page of an org's documents, newest-first, optionally filtered by a
 * free-text query (filename or tag substring, server-side). `nextCursor` is an
 * opaque token for the next page, or null when there are no more. `[]` on error.
 */
export async function listDocumentsPage(
  orgId: string,
  opts?: { search?: string; limit?: number; cursor?: string | null },
): Promise<DocumentPage> {
  const supabase = await createClient();
  const limit = opts?.limit ?? PAGE_SIZE.documents;
  const cursor = decodeCursor(opts?.cursor);

  const { data, error } = await supabase.rpc("search_documents", {
    p_org: orgId,
    p_search: opts?.search ?? "",
    p_limit: limit,
    p_before_created: cursor?.ts ?? null,
    p_before_id: cursor?.id ?? null,
  });

  if (error) {
    logger.error("documents.list_failed", { org_id: orgId, error: error.message });
    return { documents: [], nextCursor: null };
  }

  const rows = (data ?? []) as DocumentRow[];
  return {
    documents: rows.map(mapDocument),
    nextCursor: nextCursorFrom(rows, limit, (r) => ({ ts: r.created_at, id: r.id })),
  };
}

/** Total documents in an org (for the first-run nudge). 0 on error. */
export async function countDocuments(orgId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("documents")
    .select("id", { head: true, count: "exact" })
    .eq("org_id", orgId);

  if (error) {
    logger.error("documents.count_failed", { org_id: orgId, error: error.message });
    return 0;
  }
  return count ?? 0;
}

/** Does the org have at least one document? (cheap existence probe). */
export async function hasAnyDocument(orgId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id")
    .eq("org_id", orgId)
    .limit(1)
    .maybeSingle();
  if (error) {
    logger.error("documents.exists_failed", { org_id: orgId, error: error.message });
    return false;
  }
  return data != null;
}

/** A single document by id (RLS-scoped to the caller's orgs). `null` if absent. */
export async function getDocument(id: string): Promise<Document | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .select(DOCUMENT_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    logger.error("documents.get_failed", { document_id: id, error: error.message });
    return null;
  }
  return data ? mapDocument(data as DocumentRow) : null;
}
