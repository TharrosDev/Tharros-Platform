-- Assistant 1D — Enterprise tier, locations, knowledge collections, answer
-- feedback and conversation retention.
--
-- Knowledge access is enforced in the database: documents, chunks and both
-- retrieval RPCs check public.can_read_collection(). A document with no
-- collection behaves exactly as before (every org member can read it).
--
-- Apply to BOTH prod (inxhrijqyxvwoeqczbrl) and test (psunqcyzjcmfgcrnowdl).

-- 1) Enterprise tier -------------------------------------------------------
alter table public.subscriptions drop constraint if exists subscriptions_tier_check;
alter table public.subscriptions
  add constraint subscriptions_tier_check
  check (tier in ('starter', 'growth', 'pro', 'enterprise'));

-- 2) Locations -------------------------------------------------------------
create table if not exists public.locations (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 120),
  created_at timestamptz not null default now(),
  unique (org_id, name)
);

create table if not exists public.membership_locations (
  org_id      uuid not null references public.organizations (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  location_id uuid not null references public.locations (id) on delete cascade,
  primary key (user_id, location_id)
);
create index if not exists membership_locations_location_idx
  on public.membership_locations (location_id);

-- 3) Knowledge collections -------------------------------------------------
create table if not exists public.knowledge_collections (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 120),
  location_id uuid references public.locations (id) on delete set null,
  min_role    text not null default 'member' check (min_role in ('member', 'admin', 'owner')),
  created_at  timestamptz not null default now(),
  unique (org_id, name)
);

alter table public.documents
  add column if not exists collection_id uuid
  references public.knowledge_collections (id) on delete set null;
create index if not exists documents_collection_idx on public.documents (collection_id);

-- Can the caller read documents in this collection? Null = unrestricted.
-- Role must meet the collection's minimum; a location-scoped collection also
-- requires the caller to be assigned to that location (owners see all).
create or replace function public.can_read_collection(p_collection uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_collection is null or exists (
    select 1
    from public.knowledge_collections k
    cross join lateral (select public.current_user_role(k.org_id) as role) r
    where k.id = p_collection
      and r.role is not null
      and (case r.role when 'owner' then 3 when 'admin' then 2 else 1 end)
          >= (case k.min_role when 'owner' then 3 when 'admin' then 2 else 1 end)
      and (
        k.location_id is null
        or r.role = 'owner'
        or exists (
          select 1 from public.membership_locations ml
          where ml.location_id = k.location_id and ml.user_id = (select auth.uid())
        )
      )
  );
$$;
revoke execute on function public.can_read_collection(uuid) from public, anon;
grant execute on function public.can_read_collection(uuid) to authenticated;

drop policy if exists documents_select_member on public.documents;
create policy documents_select_member
  on public.documents for select to authenticated
  using (
    org_id in (select public.current_user_orgs())
    and public.can_read_collection(collection_id)
  );

drop policy if exists document_chunks_select_member on public.document_chunks;
create policy document_chunks_select_member
  on public.document_chunks for select to authenticated
  using (
    org_id in (select public.current_user_orgs())
    and exists (
      select 1 from public.documents d
      where d.id = document_id and public.can_read_collection(d.collection_id)
    )
  );

-- The retrieval RPCs are SECURITY DEFINER (they bypass RLS), so they apply the
-- collection check themselves.
create or replace function public.match_document_chunks(
  query_embedding extensions.vector(1536),
  p_org uuid,
  match_count int default 5,
  p_document_id uuid default null
)
returns table (id uuid, document_id uuid, chunk_index int, content text, similarity double precision)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.document_id, c.chunk_index, c.content,
         1 - (c.embedding OPERATOR(extensions.<=>) query_embedding) as similarity
  from public.document_chunks c
  join public.documents d on d.id = c.document_id
  where c.org_id = p_org
    and c.org_id in (select public.current_user_orgs())
    and public.can_read_collection(d.collection_id)
    and c.embedding is not null
    and (p_document_id is null or c.document_id = p_document_id)
  order by c.embedding OPERATOR(extensions.<=>) query_embedding
  limit greatest(1, least(coalesce(match_count, 5), 50));
$$;

create or replace function public.hybrid_match_document_chunks(
  query_embedding extensions.vector(1536),
  query_text text,
  p_org uuid,
  match_count int default 5,
  p_document_id uuid default null
)
returns table (id uuid, document_id uuid, chunk_index int, content text, similarity double precision)
language sql
stable
security definer
set search_path = ''
as $$
  with params as (
    select greatest(1, least(coalesce(match_count, 5), 50)) as k
  ),
  allowed as (
    select c.id, c.embedding, c.fts
    from public.document_chunks c
    join public.documents d on d.id = c.document_id
    where c.org_id = p_org
      and c.org_id in (select public.current_user_orgs())  -- membership guard
      and public.can_read_collection(d.collection_id)        -- collection guard
      and c.embedding is not null
      and (p_document_id is null or c.document_id = p_document_id)
  ),
  vec as (
    select s.id, row_number() over (order by s.dist) as r
    from (
      select a.id, a.embedding OPERATOR(extensions.<=>) query_embedding as dist
      from allowed a
      order by a.embedding OPERATOR(extensions.<=>) query_embedding
      limit (select k * 4 from params)
    ) s
  ),
  kw as (
    select s.id, row_number() over (order by s.rank desc) as r
    from (
      select a.id, pg_catalog.ts_rank_cd(a.fts, q) as rank
      from allowed a,
           pg_catalog.websearch_to_tsquery('simple'::regconfig, coalesce(query_text, '')) q
      where a.fts @@ q
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
  select c.id, c.document_id, c.chunk_index, c.content,
         1 - (c.embedding OPERATOR(extensions.<=>) query_embedding) as similarity
  from fused f
  join public.document_chunks c on c.id = f.id
  order by f.score desc
  limit (select k from params);
$$;

revoke execute on function public.match_document_chunks(extensions.vector, uuid, int, uuid) from anon, public;
grant execute on function public.match_document_chunks(extensions.vector, uuid, int, uuid) to authenticated;
revoke execute on function public.hybrid_match_document_chunks(extensions.vector, text, uuid, int, uuid) from anon, public;
grant execute on function public.hybrid_match_document_chunks(extensions.vector, text, uuid, int, uuid) to authenticated;

-- 4) Answer feedback -------------------------------------------------------
create table if not exists public.message_feedback (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  org_id     uuid not null references public.organizations (id) on delete cascade,
  rating     smallint not null check (rating in (-1, 1)),
  comment    text check (comment is null or char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
create index if not exists message_feedback_org_idx on public.message_feedback (org_id, created_at desc);

-- 5) Retention -------------------------------------------------------------
alter table public.org_settings
  add column if not exists assistant_retention_days int
  check (assistant_retention_days is null or assistant_retention_days between 1 and 3650);

-- RLS ----------------------------------------------------------------------
alter table public.locations enable row level security;
alter table public.membership_locations enable row level security;
alter table public.knowledge_collections enable row level security;
alter table public.message_feedback enable row level security;

drop policy if exists locations_select_member on public.locations;
create policy locations_select_member on public.locations for select to authenticated
  using (org_id in (select public.current_user_orgs()));
drop policy if exists membership_locations_select_member on public.membership_locations;
create policy membership_locations_select_member on public.membership_locations for select to authenticated
  using (org_id in (select public.current_user_orgs()));
drop policy if exists knowledge_collections_select_member on public.knowledge_collections;
create policy knowledge_collections_select_member on public.knowledge_collections for select to authenticated
  using (org_id in (select public.current_user_orgs()));
-- Writes to locations/assignments/collections go through owner/admin-checked
-- server actions on the service role; clients get no write grant.
revoke insert, update, delete on table public.locations from anon, authenticated;
revoke insert, update, delete on table public.membership_locations from anon, authenticated;
revoke insert, update, delete on table public.knowledge_collections from anon, authenticated;

-- Feedback: own rows, on messages in your own org; owners/admins read all.
drop policy if exists message_feedback_select on public.message_feedback;
create policy message_feedback_select on public.message_feedback for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.current_user_role(org_id) in ('owner', 'admin')
  );
drop policy if exists message_feedback_insert on public.message_feedback;
create policy message_feedback_insert on public.message_feedback for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.messages m where m.id = message_id and m.org_id = message_feedback.org_id)
    and org_id in (select public.current_user_orgs())
  );
drop policy if exists message_feedback_update on public.message_feedback;
create policy message_feedback_update on public.message_feedback for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
revoke update on table public.message_feedback from authenticated;
grant update (rating, comment) on table public.message_feedback to authenticated;

grant update (assistant_retention_days) on table public.org_settings to authenticated;

do $$
declare t text;
begin
  foreach t in array array['locations', 'membership_locations', 'knowledge_collections', 'message_feedback'] loop
    execute format('drop trigger if exists enforce_immutable_org_id on public.%I', t);
    execute format(
      'create trigger enforce_immutable_org_id before update of org_id on public.%I
       for each row execute function public.prevent_org_id_change()', t);
  end loop;
end $$;

-- 6) Retention job (pg_cron, daily 07:00 UTC). Conversations untouched for
-- longer than the org's assistant_retention_days are deleted; messages,
-- feedback and proposals cascade. Orgs with no setting keep everything.
do $cron$
begin
  -- pg_cron exists on prod only; the CI test project skips the schedule.
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'assistant-retention',
      '0 7 * * *',
      $job$delete from public.conversations c
        using public.org_settings s
        where s.org_id = c.org_id
          and s.assistant_retention_days is not null
          and c.updated_at < now() - make_interval(days => s.assistant_retention_days)$job$
    );
  end if;
end $cron$;
