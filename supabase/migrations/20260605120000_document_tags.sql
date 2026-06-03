-- Day 32 — Knowledge management: document tags + citation usage stats.
-- Two additive changes on top of the Day-23 documents schema and the Day-29
-- messages table. No destructive changes.
--
--   1. documents.tags text[] — org-member-editable labels for organizing the
--      knowledge library (filter/search in the Day-32 UI). Default '{}' so every
--      existing row is valid. GIN index for cheap containment/overlap queries.
--   2. document_citation_counts(p_org) — a SECURITY DEFINER RPC returning, per
--      document, how many assistant turns cited it and when it was last cited.
--      Source: the Day-28 Citation[] persisted in messages.citations (one entry
--      per document, keys are camelCase 'documentId'/'filename'/'index'). Powers
--      the "Cited N times" usage stat in the library. Membership-enforced via
--      public.current_user_orgs() (mirrors match_document_chunks), pinned empty
--      search_path, execute revoked from anon/public.
--
-- Apply via Supabase MCP execute_sql (NOT apply_migration) to BOTH prod
-- (inxhrijqyxvwoeqczbrl) and the CI test project (psunqcyzjcmfgcrnowdl) so the
-- schemas stay in lockstep. This file is the repo source of truth.

-- ---------------------------------------------------------------------------
-- 1. documents.tags
-- ---------------------------------------------------------------------------
alter table public.documents
  add column if not exists tags text[] not null default '{}'::text[];

create index if not exists documents_tags_gin_idx
  on public.documents using gin (tags);

comment on column public.documents.tags is
  'Day 32. Org-member-editable labels for organizing the knowledge library.
   Normalized client+server (trimmed, lowercased, deduped, capped). RLS: edited
   via the existing documents_update_member policy.';

-- ---------------------------------------------------------------------------
-- 2. document_citation_counts(p_org) — usage stats from messages.citations
-- ---------------------------------------------------------------------------
create or replace function public.document_citation_counts(p_org uuid)
returns table (document_id uuid, cited_count bigint, last_cited_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select (c->>'documentId')::uuid as document_id,
         count(*)::bigint        as cited_count,
         max(m.created_at)        as last_cited_at
  from public.messages m
       cross join lateral jsonb_array_elements(m.citations) as c
  where m.org_id = p_org
    and m.role = 'assistant'
    -- Membership guard: a non-member gets zero rows (auth.uid() comes from the
    -- caller's JWT even under SECURITY DEFINER).
    and p_org in (select public.current_user_orgs())
    and (c->>'documentId') is not null
  group by (c->>'documentId')::uuid;
$$;

comment on function public.document_citation_counts(uuid) is
  'Day 32. Per-document citation usage for an org: how many assistant turns cited
   each document (from messages.citations) and when it was last cited. Membership
   enforced via current_user_orgs(); returns no rows for a non-member.';

revoke all on function public.document_citation_counts(uuid) from public, anon;
grant execute on function public.document_citation_counts(uuid) to authenticated;
