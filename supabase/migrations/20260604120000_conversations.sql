-- Day 29 — Assistant chat: conversations + messages (Phase 2 / AI Assistant UI)
-- Persists the AI Assistant chat on top of the Day-28 RAG pipeline. Each
-- conversation belongs to one org and one author; messages are the turns.
--
-- Tables:
--   * conversations — one chat thread. (org_id, user_id) scope it; title is the
--                     first question, trimmed. updated_at bumps on each new turn.
--   * messages      — one row per turn. role 'user' | 'assistant'. `citations`
--                     is the Day-28 Citation[] for an assistant turn; `usage` is
--                     the Claude token usage (jsonb, nullable).
--
-- RLS model (mirrors the Day-23 documents pattern, with an owner-visibility twist):
--   * A conversation is visible to its AUTHOR and to the org OWNER. The owner can
--     read everyone's threads (with the asker's name, joined in the query); a
--     plain member sees only their own. Hence the SELECT adds
--     `(user_id = auth.uid() OR current_user_role(org_id) = 'owner')` on top of
--     the org-scope check.
--   * INSERT: a member may start their own thread (user_id must be self).
--   * UPDATE/DELETE: the author or the org owner (rename / clean up).
--   * messages inherit visibility from their parent conversation via an EXISTS
--     subquery — the conversations RLS filters that subselect for the caller, so
--     there is one source of truth for who-can-see-what. INSERT requires the
--     parent to be the caller's own thread. All writes are the acting user's own
--     conversation, so the user-session client (RLS on) is the only writer; no
--     service-role path is needed.
--
-- Apply via Supabase MCP execute_sql (NOT apply_migration) to BOTH prod
-- (inxhrijqyxvwoeqczbrl) and the CI test project (psunqcyzjcmfgcrnowdl) so the
-- schemas stay in lockstep. This file is the repo source of truth.

-- ---------------------------------------------------------------------------
-- conversations: one chat thread per (org, author)
-- ---------------------------------------------------------------------------
create table if not exists public.conversations (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  title      text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.conversations enable row level security;

create index if not exists conversations_org_user_updated_idx
  on public.conversations (org_id, user_id, updated_at desc);

comment on table public.conversations is
  'Day 29. One AI Assistant chat thread per (org, author). Visible to the author
   and the org owner (see RLS). title is the trimmed first question.';

-- ---------------------------------------------------------------------------
-- messages: the turns of a conversation
-- ---------------------------------------------------------------------------
create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  org_id          uuid not null references public.organizations (id) on delete cascade,
  role            text not null check (role in ('user', 'assistant')),
  content         text not null,
  citations       jsonb not null default '[]'::jsonb,
  usage           jsonb,
  created_at      timestamptz not null default now()
);

alter table public.messages enable row level security;

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at);

comment on table public.messages is
  'Day 29. One turn of a conversation. role user|assistant. citations is the
   Day-28 Citation[] for assistant turns; usage is Claude token usage.';

-- ---------------------------------------------------------------------------
-- RLS — conversations (author + org owner visibility)
-- ---------------------------------------------------------------------------
drop policy if exists conversations_select on public.conversations;
create policy conversations_select
  on public.conversations
  for select
  to authenticated
  using (
    org_id in (select public.current_user_orgs())
    and (
      user_id = (select auth.uid())
      or public.current_user_role(org_id) = 'owner'
    )
  );

drop policy if exists conversations_insert on public.conversations;
create policy conversations_insert
  on public.conversations
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and public.current_user_role(org_id) is not null
  );

drop policy if exists conversations_update on public.conversations;
create policy conversations_update
  on public.conversations
  for update
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.current_user_role(org_id) = 'owner'
  )
  with check (
    org_id in (select public.current_user_orgs())
  );

drop policy if exists conversations_delete on public.conversations;
create policy conversations_delete
  on public.conversations
  for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.current_user_role(org_id) = 'owner'
  );

-- ---------------------------------------------------------------------------
-- RLS — messages (inherit parent conversation visibility)
-- ---------------------------------------------------------------------------
drop policy if exists messages_select on public.messages;
create policy messages_select
  on public.messages
  for select
  to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
    )
  );

drop policy if exists messages_insert on public.messages;
create policy messages_insert
  on public.messages
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and c.user_id = (select auth.uid())
    )
  );

drop policy if exists messages_delete on public.messages;
create policy messages_delete
  on public.messages
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.user_id = (select auth.uid()) or public.current_user_role(c.org_id) = 'owner')
    )
  );
