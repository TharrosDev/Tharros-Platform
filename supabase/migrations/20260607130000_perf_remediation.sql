-- Perf remediation — denormalized citation counters, keyset document search,
-- and an atomic owned-org delete. Applied to prod + the CI test project via
-- Supabase MCP execute_sql (repo source of truth).

-- ===========================================================================
-- 1. Denormalized per-document citation counters
-- ===========================================================================
-- `document_citation_counts(p_org)` re-scanned EVERY assistant message's
-- `citations` jsonb (cross join lateral) on every /knowledge load — an org-wide
-- scan per page view. Replace it with two columns kept current by a trigger.
-- The RPC stays as the backfill source of truth.

alter table public.documents
  add column if not exists cited_count  integer     not null default 0,
  add column if not exists last_cited_at timestamptz;

-- Backfill from existing assistant citations. Counts distinct (message, doc)
-- pairs so it matches the trigger's "+1 per assistant message per cited doc".
with per_msg as (
  select distinct m.id as msg_id, (c->>'documentId')::uuid as document_id, m.created_at
  from public.messages m
       cross join lateral jsonb_array_elements(m.citations) as c
  where m.role = 'assistant' and (c->>'documentId') is not null
),
counts as (
  select document_id, count(*) as n, max(created_at) as last_at
  from per_msg
  group by document_id
)
update public.documents d
set cited_count = counts.n, last_cited_at = counts.last_at
from counts
where d.id = counts.document_id;

-- Trigger: bump counters when an assistant message with citations is inserted.
-- SECURITY DEFINER so it can update documents regardless of the inserting role;
-- it only ever touches rows referenced by the new message's own citations.
create or replace function public.bump_document_citations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role = 'assistant'
     and jsonb_array_length(coalesce(new.citations, '[]'::jsonb)) > 0 then
    update public.documents d
    set cited_count   = d.cited_count + 1,
        last_cited_at = new.created_at
    where d.id in (
      select (c->>'documentId')::uuid
      from jsonb_array_elements(new.citations) as c
      where (c->>'documentId') is not null
    );
  end if;
  return new;
end;
$$;

revoke execute on function public.bump_document_citations() from anon, authenticated, public;

drop trigger if exists messages_bump_citations on public.messages;
create trigger messages_bump_citations
  after insert on public.messages
  for each row execute function public.bump_document_citations();

-- ===========================================================================
-- 2. Keyset document search (org-scoped, filename + tag substring)
-- ===========================================================================
-- Replaces the unbounded `listDocuments` SELECT + client-side filter. Returns
-- one page newest-first; `(created_at, id)` is the keyset cursor. Membership is
-- enforced the same way as match_document_chunks (auth.uid() from the caller's
-- JWT under SECURITY DEFINER). Backed by documents_org_created_idx.
create or replace function public.search_documents(
  p_org            uuid,
  p_search         text        default '',
  p_limit          integer     default 50,
  p_before_created timestamptz default null,
  p_before_id      uuid        default null
)
returns table (
  id            uuid,
  org_id        uuid,
  uploaded_by   uuid,
  storage_path  text,
  filename      text,
  mime_type     text,
  size_bytes    bigint,
  status        text,
  error         text,
  tags          text[],
  cited_count   integer,
  last_cited_at timestamptz,
  created_at    timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select d.id, d.org_id, d.uploaded_by, d.storage_path, d.filename, d.mime_type,
         d.size_bytes, d.status, d.error, d.tags, d.cited_count, d.last_cited_at,
         d.created_at
  from public.documents d
  where d.org_id = p_org
    and p_org in (select public.current_user_orgs())
    and (
      coalesce(btrim(p_search), '') = ''
      or d.filename ilike '%' || p_search || '%'
      or exists (select 1 from unnest(d.tags) as t where t ilike '%' || p_search || '%')
    )
    and (
      p_before_created is null
      or (d.created_at < p_before_created)
      or (d.created_at = p_before_created and d.id < p_before_id)
    )
  order by d.created_at desc, d.id desc
  limit greatest(1, least(coalesce(p_limit, 50), 100));
$$;

revoke all     on function public.search_documents(uuid, text, integer, timestamptz, uuid) from public, anon;
grant  execute on function public.search_documents(uuid, text, integer, timestamptz, uuid) to authenticated;

-- ===========================================================================
-- 3. Atomic owned-org delete (account deletion path)
-- ===========================================================================
-- deleteAccount previously deleted sole-owned orgs in a per-org loop with no
-- surrounding transaction — a partial failure orphaned rows. This deletes them
-- all in one statement, re-verifying sole ownership server-side (never trusts
-- the id list). Called via the service-role admin client (auth.uid() is null
-- there), so it takes the verified user id explicitly and is execute-revoked
-- from anon/authenticated.
create or replace function public.delete_owned_orgs(p_user uuid, p_org_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer := 0;
begin
  if p_user is null or p_org_ids is null or cardinality(p_org_ids) = 0 then
    return 0;
  end if;

  delete from public.organizations o
  where o.id = any(p_org_ids)
    -- caller owns it…
    and exists (
      select 1 from public.memberships m
      where m.org_id = o.id and m.user_id = p_user and m.role = 'owner'
    )
    -- …and is the ONLY owner (so it can't survive them).
    and not exists (
      select 1 from public.memberships m2
      where m2.org_id = o.id and m2.role = 'owner' and m2.user_id <> p_user
    );

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.delete_owned_orgs(uuid, uuid[]) from public, anon, authenticated;
