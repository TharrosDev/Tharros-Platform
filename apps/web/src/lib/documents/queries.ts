import "server-only";

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/observability/logger";
import type { Document, DocumentStatus } from "@/lib/documents/types";

/**
 * Day 23 — read-side document data for the org library (Day 24 UI consumes this).
 * Goes through the SSR user-session client, so the Day-23 RLS policies scope
 * every row to the caller's orgs — no manual org filter needed for safety, but
 * `listDocuments` filters by org_id to pick the active org out of the user's set.
 */

// Shape of the PostgREST row (clients are untyped in this repo).
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
    createdAt: row.created_at,
  };
}

const DOCUMENT_COLUMNS =
  "id, org_id, uploaded_by, storage_path, filename, mime_type, size_bytes, status, error, tags, created_at";

/** Documents in an org the caller belongs to, newest first. `[]` on error. */
export async function listDocuments(orgId: string): Promise<Document[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .select(DOCUMENT_COLUMNS)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) {
    logger.error("documents.list_failed", { org_id: orgId, error: error.message });
    return [];
  }
  return (data as DocumentRow[]).map(mapDocument);
}

/** Per-document citation usage in an org, keyed by documentId. Empty map on error. */
export type DocumentCitationStat = { citedCount: number; lastCitedAt: string | null };

export async function getDocumentCitationCounts(
  orgId: string,
): Promise<Map<string, DocumentCitationStat>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("document_citation_counts", { p_org: orgId });

  const stats = new Map<string, DocumentCitationStat>();
  if (error) {
    logger.error("documents.citation_counts_failed", { org_id: orgId, error: error.message });
    return stats;
  }
  for (const row of (data ?? []) as {
    document_id: string;
    cited_count: number;
    last_cited_at: string | null;
  }[]) {
    stats.set(row.document_id, {
      citedCount: Number(row.cited_count),
      lastCitedAt: row.last_cited_at,
    });
  }
  return stats;
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
