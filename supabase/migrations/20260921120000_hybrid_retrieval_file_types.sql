-- Assistant 1B — hybrid retrieval + new knowledge file types.
--
-- 1. document_chunks.fts: a generated tsvector (the 'simple' config — no
--    stemming, language-neutral, so exact terms like SKUs, names and French
--    text still match) with a GIN index.
-- 2. hybrid_match_document_chunks(): vector top-N + keyword top-N merged with
--    reciprocal rank fusion (k = 60). Same membership guard and return shape as
--    match_document_chunks, so callers swap RPCs without other changes.
-- 3. The documents bucket accepts CSV, XLSX, PPTX and PNG/JPEG/WEBP (images and
--    scanned PDFs are OCR'd by the extract route).
--
-- Apply to BOTH prod (inxhrijqyxvwoeqczbrl) and the CI test project
-- (psunqcyzjcmfgcrnowdl).

alter table public.document_chunks
  add column if not exists fts tsvector
  generated always as (to_tsvector('simple'::regconfig, content)) stored;

create index if not exists document_chunks_fts_idx
  on public.document_chunks using gin (fts);

create or replace function public.hybrid_match_document_chunks(
  query_embedding extensions.vector(1536),
  query_text text,
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
  with params as (
    select greatest(1, least(coalesce(match_count, 5), 50)) as k
  ),
  vec as (
    select s.id, row_number() over (order by s.dist) as r
    from (
      select c.id, c.embedding OPERATOR(extensions.<=>) query_embedding as dist
      from public.document_chunks c
      where c.org_id = p_org
        and c.org_id in (select public.current_user_orgs())  -- membership guard
        and c.embedding is not null
        and (p_document_id is null or c.document_id = p_document_id)
      order by c.embedding OPERATOR(extensions.<=>) query_embedding
      limit (select k * 4 from params)
    ) s
  ),
  kw as (
    select s.id, row_number() over (order by s.rank desc) as r
    from (
      select c.id, pg_catalog.ts_rank_cd(c.fts, q) as rank
      from public.document_chunks c,
           pg_catalog.websearch_to_tsquery('simple'::regconfig, coalesce(query_text, '')) q
      where c.org_id = p_org
        and c.org_id in (select public.current_user_orgs())  -- membership guard
        and c.embedding is not null
        and c.fts @@ q
        and (p_document_id is null or c.document_id = p_document_id)
      order by rank desc
      limit (select k * 4 from params)
    ) s
  ),
  fused as (
    select coalesce(v.id, w.id) as id,
           coalesce(1.0 / (60 + v.r), 0) + coalesce(1.0 / (60 + w.r), 0) as score
    from vec v
    full outer join kw w on w.id = v.id
  )
  select
    c.id,
    c.document_id,
    c.chunk_index,
    c.content,
    1 - (c.embedding OPERATOR(extensions.<=>) query_embedding) as similarity
  from fused f
  join public.document_chunks c on c.id = f.id
  order by f.score desc
  limit (select k from params);
$$;

comment on function public.hybrid_match_document_chunks(extensions.vector, text, uuid, int, uuid) is
  'Assistant 1B. Org-scoped hybrid (vector + keyword, RRF k=60) chunk search.
   Membership-enforced (current_user_orgs); optional p_document_id filter.';

revoke execute on function public.hybrid_match_document_chunks(extensions.vector, text, uuid, int, uuid) from anon, public;
grant execute on function public.hybrid_match_document_chunks(extensions.vector, text, uuid, int, uuid) to authenticated;

update storage.buckets
set allowed_mime_types = array[
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/markdown',
      'text/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/png',
      'image/jpeg',
      'image/webp'
    ]::text[]
where id = 'documents';
