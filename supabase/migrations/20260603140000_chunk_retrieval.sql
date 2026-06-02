-- Day 27 — Vector retrieval
-- Day 26 fills document_chunks with 1536-dim embeddings. This adds the pieces
-- that let the app FIND the most relevant chunks for a query:
--   1. An HNSW ANN index on the embedding (deferred from Day 23) using cosine
--      distance — matches OpenAI's normalized embeddings + the `<=>` operator.
--   2. match_document_chunks() — a SECURITY DEFINER top-k similarity search,
--      org-scoped and membership-enforced, with an optional document filter.
--
-- Cosine (vector_cosine_ops / `<=>`) is the right metric for text-embedding-3-small.
-- HNSW (vs IVFFlat) needs no training, gives strong recall, and is the right
-- default well under ~1M rows.
--
-- Applied to the live DB via Supabase MCP execute_sql (NOT apply_migration) to
-- keep Supabase's own migration history clean; this file is the repo source of
-- truth. Apply to BOTH prod (inxhrijqyxvwoeqczbrl) and the CI test project
-- (psunqcyzjcmfgcrnowdl) so the schemas stay in lockstep.

-- ---------------------------------------------------------------------------
-- HNSW cosine index. Cheap to build at MVP row counts; speeds up `<=>` ordering.
-- ---------------------------------------------------------------------------
create index if not exists document_chunks_embedding_hnsw
  on public.document_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

-- ---------------------------------------------------------------------------
-- match_document_chunks(): org-scoped top-k similarity search.
-- SECURITY DEFINER so it can read across the (member-read-only) chunks table,
-- but it enforces membership itself: results are restricted to orgs the caller
-- belongs to (current_user_orgs), AND to the requested p_org. search_path pinned
-- + objects schema-qualified per the advisor. Returns cosine similarity in
-- [0,1] (1 = identical) so callers can threshold; ordered best-first.
-- ---------------------------------------------------------------------------
create or replace function public.match_document_chunks(
  query_embedding extensions.vector(1536),
  p_org uuid,
  match_count int default 5,
  p_document_id uuid default null
)
returns table (
  id uuid,
  document_id uuid,
  chunk_index int,
  content text,
  similarity double precision
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    c.document_id,
    c.chunk_index,
    c.content,
    1 - (c.embedding OPERATOR(extensions.<=>) query_embedding) as similarity
  from public.document_chunks c
  where c.org_id = p_org
    and c.org_id in (select public.current_user_orgs())  -- membership guard
    and c.embedding is not null
    and (p_document_id is null or c.document_id = p_document_id)
  order by c.embedding OPERATOR(extensions.<=>) query_embedding
  limit greatest(1, least(coalesce(match_count, 5), 50));
$$;

comment on function public.match_document_chunks(extensions.vector, uuid, int, uuid) is
  'Day 27. Org-scoped top-k cosine similarity search over document_chunks.
   Membership-enforced (current_user_orgs); optional p_document_id filter.';

-- anon can never search; authenticated retains Supabase''s default-privilege grant.
revoke execute on function public.match_document_chunks(extensions.vector, uuid, int, uuid) from anon, public;
grant execute on function public.match_document_chunks(extensions.vector, uuid, int, uuid) to authenticated;
