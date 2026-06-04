-- Day 39 — Agent orchestration layer (Phase 3 / AI Workforce Scheduling)
-- The net-new rails the scheduling agents run on. The real solver + scheduling
-- tools come Days 46–48; this migration is rails only:
--   * ai_conversation_threads — an operational agent conversation (distinct from
--     the Day-29 `conversations`/`messages`, which are the user-facing document
--     Q&A chat). These are agent-driven, org-scoped threads (future:
--     availability collection, sick-call, swap negotiation). A thread carries a
--     `mode` ('ai' | 'human') — the MANAGER-TAKEOVER seam: while human-owned the
--     TS turn handler is bypassed entirely.
--   * agent_turns — one row per turn. `content` is the full Anthropic content-
--     block array (text + tool_use + tool_result) so the loop replays verbatim.
--   * agent_audit_log — every AI decision (turn start, model call, tool call,
--     takeover, completion). Deny-all RLS, service-role only (like jobs /
--     stripe_events / rate_limit_events).
--
-- RLS reuses public.current_user_orgs() / public.current_user_role(uuid) and the
-- shared public.set_updated_at() trigger. New SECURITY DEFINER RPCs pin
-- `set search_path = ''`, schema-qualify everything, and revoke execute from
-- anon/public (per the project convention).
--
-- Apply via Supabase MCP execute_sql (NOT apply_migration) to BOTH prod
-- (inxhrijqyxvwoeqczbrl) and the CI test project (psunqcyzjcmfgcrnowdl) so the
-- schemas stay in lockstep. This file is the repo source of truth.

-- ---------------------------------------------------------------------------
-- ai_conversation_threads: one operational agent conversation, org-scoped.
--   mode: 'ai'  → the turn handler runs the agent on this thread.
--         'human' → a manager has taken over; the turn handler is bypassed.
--   status: 'open' | 'closed'.
-- created_by is nullable: agent/system-created threads have no human author.
-- ---------------------------------------------------------------------------
create table if not exists public.ai_conversation_threads (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  created_by    uuid references auth.users (id) on delete set null,
  kind          text not null default 'agent',
  title         text not null default 'Agent thread',
  mode          text not null default 'ai'   check (mode in ('ai', 'human')),
  status        text not null default 'open' check (status in ('open', 'closed')),
  taken_over_by uuid references auth.users (id) on delete set null,
  taken_over_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.ai_conversation_threads enable row level security;

create index if not exists ai_conversation_threads_org_updated_idx
  on public.ai_conversation_threads (org_id, updated_at desc);

comment on table public.ai_conversation_threads is
  'Day 39. An operational agent conversation (scheduling product), org-scoped and
   readable by the whole org. mode=ai|human is the manager-takeover seam: while
   human, the TS turn handler is bypassed. Distinct from Day-29 conversations.';

-- ---------------------------------------------------------------------------
-- agent_turns: the turns of an agent thread. content holds the raw Anthropic
-- content-block array (text + tool_use + tool_result) so runAgentTurn can
-- rebuild the exact message history Claude needs across a tool-use loop.
-- ---------------------------------------------------------------------------
create table if not exists public.agent_turns (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null references public.ai_conversation_threads (id) on delete cascade,
  org_id      uuid not null references public.organizations (id) on delete cascade,
  role        text not null check (role in ('user', 'assistant', 'tool')),
  content     jsonb not null default '[]'::jsonb,
  stop_reason text,
  usage       jsonb,
  created_at  timestamptz not null default now()
);

alter table public.agent_turns enable row level security;

create index if not exists agent_turns_thread_created_idx
  on public.agent_turns (thread_id, created_at);

comment on table public.agent_turns is
  'Day 39. One turn of an agent thread. role user|assistant|tool. content is the
   raw Anthropic content-block array so the tool-use loop replays verbatim;
   usage is Claude token usage.';

-- ---------------------------------------------------------------------------
-- agent_audit_log: every AI decision on a thread. Deny-all RLS — the service-
-- role turn handler is the only writer/reader, like jobs / stripe_events.
-- (rls_enabled_no_policy INFO is expected.)
-- ---------------------------------------------------------------------------
create table if not exists public.agent_audit_log (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations (id) on delete cascade,
  thread_id  uuid references public.ai_conversation_threads (id) on delete cascade,
  turn_id    uuid references public.agent_turns (id) on delete set null,
  actor      text not null check (actor in ('ai', 'human', 'system')),
  action     text not null,
  model      text,
  detail     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.agent_audit_log enable row level security;

create index if not exists agent_audit_log_org_created_idx
  on public.agent_audit_log (org_id, created_at desc);
create index if not exists agent_audit_log_thread_created_idx
  on public.agent_audit_log (thread_id, created_at);

comment on table public.agent_audit_log is
  'Day 39. Audit trail of every AI decision on an agent thread (turn_started,
   model_call, tool_invoked, takeover, turn_completed, ...). Deny-all RLS;
   service-role only.';

-- updated_at bump (reuses the shared trigger fn from the subscriptions migration).
drop trigger if exists ai_conversation_threads_set_updated_at on public.ai_conversation_threads;
create trigger ai_conversation_threads_set_updated_at
  before update on public.ai_conversation_threads
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — ai_conversation_threads. Unlike Day-29 conversations (author-private),
-- operational agent threads are readable by the WHOLE org: a manager taking a
-- thread over needs to see it. Writes are gated to org members; the takeover
-- columns flip only through the RPCs below (atomic + auditable), not raw UPDATE.
-- ---------------------------------------------------------------------------
drop policy if exists ai_conversation_threads_select on public.ai_conversation_threads;
create policy ai_conversation_threads_select
  on public.ai_conversation_threads
  for select
  to authenticated
  using (org_id in (select public.current_user_orgs()));

drop policy if exists ai_conversation_threads_insert on public.ai_conversation_threads;
create policy ai_conversation_threads_insert
  on public.ai_conversation_threads
  for insert
  to authenticated
  with check (public.current_user_role(org_id) is not null);

drop policy if exists ai_conversation_threads_update on public.ai_conversation_threads;
create policy ai_conversation_threads_update
  on public.ai_conversation_threads
  for update
  to authenticated
  using (public.current_user_role(org_id) is not null)
  with check (org_id in (select public.current_user_orgs()));

drop policy if exists ai_conversation_threads_delete on public.ai_conversation_threads;
create policy ai_conversation_threads_delete
  on public.ai_conversation_threads
  for delete
  to authenticated
  using (public.current_user_role(org_id) = 'owner');

-- ---------------------------------------------------------------------------
-- RLS — agent_turns. SELECT inherits the parent thread's visibility via an
-- EXISTS subquery (the threads RLS filters the subselect — one source of truth).
-- A member may post a 'user' turn into a thread their org can see; assistant/tool
-- turns are written by the service-role turn handler (bypasses RLS).
-- ---------------------------------------------------------------------------
drop policy if exists agent_turns_select on public.agent_turns;
create policy agent_turns_select
  on public.agent_turns
  for select
  to authenticated
  using (
    exists (
      select 1 from public.ai_conversation_threads t
      where t.id = thread_id
    )
  );

drop policy if exists agent_turns_insert on public.agent_turns;
create policy agent_turns_insert
  on public.agent_turns
  for insert
  to authenticated
  with check (
    role = 'user'
    and exists (
      select 1 from public.ai_conversation_threads t
      where t.id = thread_id
        and t.org_id in (select public.current_user_orgs())
    )
  );

-- agent_audit_log: deny-all. No policies — service-role only.
-- (RLS enabled above; intentionally no policies. rls_enabled_no_policy INFO expected.)

-- ---------------------------------------------------------------------------
-- take_over_thread(): a manager takes an agent thread over (AI → human). Flips
-- mode='human', stamps who/when. Asserts the caller is a member of the thread's
-- org. SECURITY DEFINER so the flip is atomic + the only door to the takeover
-- columns. Grant to authenticated (the manager); revoke from anon/public.
-- ---------------------------------------------------------------------------
create or replace function public.take_over_thread(p_thread uuid)
returns public.ai_conversation_threads
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_row public.ai_conversation_threads;
begin
  select org_id into v_org from public.ai_conversation_threads where id = p_thread;
  if v_org is null then
    raise exception 'thread not found';
  end if;
  if public.current_user_role(v_org) is null then
    raise exception 'not a member of this org';
  end if;

  update public.ai_conversation_threads
  set mode = 'human',
      taken_over_by = (select auth.uid()),
      taken_over_at = now()
  where id = p_thread
  returning * into v_row;

  return v_row;
end;
$$;

comment on function public.take_over_thread(uuid) is
  'Day 39. Manager takeover: flip an agent thread to mode=human (bypasses the AI
   turn handler), stamping taken_over_by/at. Org-member gated. SECURITY DEFINER.';

revoke execute on function public.take_over_thread(uuid) from anon, public;
grant execute on function public.take_over_thread(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- release_thread(): hand a thread back to the agent (human → AI). Resets mode
-- and clears the takeover stamps. Same org-member gate.
-- ---------------------------------------------------------------------------
create or replace function public.release_thread(p_thread uuid)
returns public.ai_conversation_threads
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_row public.ai_conversation_threads;
begin
  select org_id into v_org from public.ai_conversation_threads where id = p_thread;
  if v_org is null then
    raise exception 'thread not found';
  end if;
  if public.current_user_role(v_org) is null then
    raise exception 'not a member of this org';
  end if;

  update public.ai_conversation_threads
  set mode = 'ai',
      taken_over_by = null,
      taken_over_at = null
  where id = p_thread
  returning * into v_row;

  return v_row;
end;
$$;

comment on function public.release_thread(uuid) is
  'Day 39. Release a manager-taken-over thread back to the AI turn handler
   (mode=ai), clearing the takeover stamps. Org-member gated. SECURITY DEFINER.';

revoke execute on function public.release_thread(uuid) from anon, public;
grant execute on function public.release_thread(uuid) to authenticated;
