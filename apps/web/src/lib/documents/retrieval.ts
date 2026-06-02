import "server-only";

import { createClient } from "@/lib/supabase/server";
import { embedTexts, toVectorLiteral } from "@/lib/documents/embeddings";
import { logger } from "@/lib/observability/logger";

/**
 * Day 27 — vector retrieval. Embeds a query with the same seam used for
 * ingestion (so query + chunks share an embedding space), then calls the
 * org-scoped `match_document_chunks` RPC for top-k cosine matches. This is the
 * retrieval half of RAG; Day 28 feeds these chunks to Claude as grounded context.
 *
 * Goes through the SSR user-session client so the RPC's membership guard
 * (current_user_orgs) evaluates the real caller.
 */

export type RetrievedChunk = {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  /** Cosine similarity in [0,1]; 1 = identical. */
  similarity: number;
};

export type SearchOptions = {
  /** Max chunks to return (RPC clamps to 1..50). */
  limit?: number;
  /** Restrict the search to a single document. */
  documentId?: string;
};

type MatchRow = {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  similarity: number;
};

/**
 * Top-k most relevant chunks in `orgId` for `query`. Returns [] on a blank query
 * or any failure (logged) — retrieval is best-effort; the caller decides how to
 * handle "no context".
 */
export async function searchChunks(
  orgId: string,
  query: string,
  options: SearchOptions = {},
): Promise<RetrievedChunk[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  let queryEmbedding: number[];
  try {
    [queryEmbedding] = await embedTexts([trimmed]);
  } catch (err) {
    logger.error("retrieval.embed_query_failed", { org_id: orgId, err });
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("match_document_chunks", {
    query_embedding: toVectorLiteral(queryEmbedding),
    p_org: orgId,
    match_count: options.limit ?? 5,
    p_document_id: options.documentId ?? null,
  });

  if (error) {
    logger.error("retrieval.match_failed", { org_id: orgId, error: error.message });
    return [];
  }

  return (data as MatchRow[]).map((r) => ({
    id: r.id,
    documentId: r.document_id,
    chunkIndex: r.chunk_index,
    content: r.content,
    similarity: r.similarity,
  }));
}
