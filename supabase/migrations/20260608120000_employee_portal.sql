-- Day 37 — Employee portal foundation (Phase 3 / AI Workforce Scheduling)
-- The auth-light access spine the scheduling product sits on. Shift-workers have
-- NO Supabase account: they reach a tokenized mobile portal via a signed
-- magic-link email, scoped to their org + employee identity.
--
-- This migration adds:
--   * employees                — minimal roster identity (Day 41 ALTERs in the
--                                scheduling columns: roles, employment type,
--                                seniority, hour targets). The token anchor.
--   * employee_portal_tokens   — one live opaque token per employee. Delivered in
--                                the magic-link; stored in an httpOnly cookie by
--                                the portal. Rotatable + revocable.
--   * new_portal_token()       — 256-bit token generator (Day-15 pattern).
--   * issue_portal_token()     — owner/admin mints/rotates an employee's token.
--   * validate_portal_token()  — the portal's ONLY DB door: takes a token, returns
--                                the scoped employee identity. Granted to anon
--                                (the portal caller is unauthenticated).
--
-- Pattern mirrors the Day-15 invites: tokenized, all writes through self-guarding
-- SECURITY DEFINER RPCs, RLS read-only to managers, deny-all to anon. The DB stays
-- the gatekeeper — there is no app-code tenancy scoping to get wrong.
--
-- Applied to the live DB via Supabase MCP execute_sql (NOT apply_migration) to keep
-- Supabase's own migration history clean; this file is the repo source of truth.
-- Must also be applied to the CI test project (psunqcyzjcmfgcrnowdl).

-- ---------------------------------------------------------------------------
-- employees: minimal roster identity (one row per worker the manager adds).
-- No auth.users link — employees are account-less; the portal token is their
-- only credential. Day 41 extends this table with the scheduling columns.
-- ---------------------------------------------------------------------------
create table if not exists public.employees (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations (id) on delete cascade,
  name       text not null,
  email      text not null,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.employees enable row level security;

create index if not exists employees_org_id_idx on public.employees (org_id);

comment on table public.employees is
  'Day 37. Account-less roster identity for the scheduling product; anchor for the
   employee portal tokens. Day 41 ALTERs in roles/employment type/seniority/etc.';

-- RLS: any org member can read the roster; only owners/admins write it. Deny-all
-- to anon — the portal never reads employees directly, only via the validate RPC.
drop policy if exists employees_select_member on public.employees;
create policy employees_select_member
  on public.employees
  for select
  to authenticated
  using (org_id in (select public.current_user_orgs()));

drop policy if exists employees_insert_manager on public.employees;
create policy employees_insert_manager
  on public.employees
  for insert
  to authenticated
  with check (public.current_user_role(org_id) in ('owner', 'admin'));

drop policy if exists employees_update_manager on public.employees;
create policy employees_update_manager
  on public.employees
  for update
  to authenticated
  using (public.current_user_role(org_id) in ('owner', 'admin'))
  with check (public.current_user_role(org_id) in ('owner', 'admin'));

drop policy if exists employees_delete_manager on public.employees;
create policy employees_delete_manager
  on public.employees
  for delete
  to authenticated
  using (public.current_user_role(org_id) in ('owner', 'admin'));

-- ---------------------------------------------------------------------------
-- employee_portal_tokens: one row per issued magic-link token. revoked_at NULL
-- (+ expires_at NULL or future) means "live". The token is the credential the
-- portal stores in an httpOnly cookie and re-validates on every request.
-- ---------------------------------------------------------------------------
create table if not exists public.employee_portal_tokens (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references public.employees (id) on delete cascade,
  org_id       uuid not null references public.organizations (id) on delete cascade,
  token        text not null unique,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz,
  revoked_at   timestamptz,
  last_used_at timestamptz
);

alter table public.employee_portal_tokens enable row level security;

create index if not exists employee_portal_tokens_employee_idx
  on public.employee_portal_tokens (employee_id);
create index if not exists employee_portal_tokens_token_idx
  on public.employee_portal_tokens (token);

-- At most one LIVE token per employee — re-issuing revokes the prior one.
create unique index if not exists employee_portal_tokens_one_live_per_employee
  on public.employee_portal_tokens (employee_id)
  where revoked_at is null;

comment on table public.employee_portal_tokens is
  'Day 37. Opaque magic-link tokens for the account-less employee portal. Writes
   via SECURITY DEFINER RPCs; RLS read-only to managers; validated by anon via
   validate_portal_token().';

-- RLS: managers may read their org's tokens (e.g. to show last-used). No
-- INSERT/UPDATE/DELETE policies — all writes go through the RPCs below. anon gets
-- nothing direct.
drop policy if exists employee_portal_tokens_select_manager on public.employee_portal_tokens;
create policy employee_portal_tokens_select_manager
  on public.employee_portal_tokens
  for select
  to authenticated
  using (public.current_user_role(org_id) in ('owner', 'admin'));

-- ---------------------------------------------------------------------------
-- token generator: 256 bits of randomness as hex from core gen_random_uuid()
-- (no pgcrypto dependency). Same construction as Day-15 new_invite_token().
-- ---------------------------------------------------------------------------
create or replace function public.new_portal_token()
returns text
language sql
volatile
set search_path = ''
as $$
  select replace(gen_random_uuid()::text, '-', '')
       || replace(gen_random_uuid()::text, '-', '');
$$;

revoke execute on function public.new_portal_token() from anon, authenticated, public;

-- ---------------------------------------------------------------------------
-- issue_portal_token(): owner/admin mints a fresh token for one of their
-- employees, revoking any existing live token (rotation). Returns the new token
-- so the caller can build the magic-link + email it. SECURITY DEFINER so the
-- write bypasses the no-write-policy table; the role guard is the gate.
-- ---------------------------------------------------------------------------
create or replace function public.issue_portal_token(p_employee_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org   uuid;
  v_token text := public.new_portal_token();
begin
  select e.org_id into v_org from public.employees e where e.id = p_employee_id;
  if v_org is null then
    raise exception 'Employee not found' using errcode = 'no_data_found';
  end if;
  -- coalesce: current_user_role() is NULL for non-members, and `NULL not in (...)`
  -- is NULL (not true) — without this an outsider would slip past the guard.
  if coalesce(public.current_user_role(v_org), '') not in ('owner', 'admin') then
    raise exception 'Only an owner or admin can issue a portal link'
      using errcode = 'insufficient_privilege';
  end if;

  -- Revoke the current live token (the partial unique index allows only one).
  update public.employee_portal_tokens
  set revoked_at = now()
  where employee_id = p_employee_id and revoked_at is null;

  insert into public.employee_portal_tokens (employee_id, org_id, token)
  values (p_employee_id, v_org, v_token);

  return v_token;
end;
$$;

comment on function public.issue_portal_token(uuid) is
  'Day 37. Owner/admin mints + rotates an employee portal token. Returns the token.';

revoke execute on function public.issue_portal_token(uuid) from anon, public;
grant  execute on function public.issue_portal_token(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- validate_portal_token(): the portal's ONLY DB door. Takes an opaque token and
-- returns the scoped employee identity iff the token is live (not revoked, not
-- expired) AND the employee is active. Bumps last_used_at. Returns no rows
-- otherwise. Granted to anon because the portal caller has no Supabase session.
-- SECURITY DEFINER reads past the deny-to-anon RLS; the token IS the authorization.
-- ---------------------------------------------------------------------------
create or replace function public.validate_portal_token(p_token text)
returns table (
  employee_id   uuid,
  org_id        uuid,
  employee_name text,
  org_name      text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_employee uuid;
begin
  select t.employee_id into v_employee
  from public.employee_portal_tokens t
  join public.employees e on e.id = t.employee_id
  where t.token = p_token
    and t.revoked_at is null
    and (t.expires_at is null or t.expires_at > now())
    and e.active;

  if v_employee is null then
    return; -- no rows: invalid / revoked / expired / inactive
  end if;

  update public.employee_portal_tokens
  set last_used_at = now()
  where token = p_token;

  return query
  select e.id, e.org_id, e.name, o.name
  from public.employees e
  join public.organizations o on o.id = e.org_id
  where e.id = v_employee;
end;
$$;

comment on function public.validate_portal_token(text) is
  'Day 37. Portal session validator: token -> scoped employee identity (or no rows).
   Granted to anon — the account-less portal calls this on every request.';

revoke execute on function public.validate_portal_token(text) from public;
grant  execute on function public.validate_portal_token(text) to anon, authenticated;
