-- Day 15 — Team management (invites)
-- Lets owners/admins bring teammates into an org: a tokenized email invite with a
-- 7-day expiry, an accept flow that works for brand-new and existing users, role
-- assignment, member removal, and a pending-invites list. Member removal + role
-- changes ride the existing Day-11 memberships policies + last-owner guard; this
-- migration only adds the invites table and its SECURITY DEFINER RPCs.
--
-- Pattern mirrors Day 12 (org onboarding): the only user-facing write paths are
-- self-guarding SECURITY DEFINER RPCs, so RLS on the table stays read-only-to-
-- managers and acceptance happens by token without exposing rows to invitees.
--
-- Applied to the live DB via Supabase MCP execute_sql (NOT apply_migration) to
-- keep Supabase's own migration history clean; this file is the repo source of
-- truth. Must also be applied to the CI test project (psunqcyzjcmfgcrnowdl).

-- ---------------------------------------------------------------------------
-- invites: one row per outstanding/used invite. accepted_at / revoked_at NULL
-- means "live". Role is constrained to admin|member (owner is never granted by
-- invite — ownership transfer is a separate, later concern).
-- ---------------------------------------------------------------------------
create table if not exists public.invites (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  email       text not null,
  role        text not null check (role in ('admin', 'member')),
  token       text not null unique,
  invited_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  revoked_at  timestamptz
);

alter table public.invites enable row level security;

comment on table public.invites is
  'Day 15. Tokenized team invites. Writes go through SECURITY DEFINER RPCs; RLS is read-only to org owners/admins.';

create index if not exists invites_org_id_idx on public.invites (org_id);
create index if not exists invites_token_idx on public.invites (token);

-- At most one LIVE invite per (org, email). Accepted/revoked rows are excluded so
-- a fresh invite can always be issued after one is used or revoked.
create unique index if not exists invites_one_live_per_email
  on public.invites (org_id, lower(email))
  where accepted_at is null and revoked_at is null;

-- ---------------------------------------------------------------------------
-- RLS: only org owners/admins can read their org's invites (the pending list).
-- Invitees never read rows directly — they accept by token through the RPC.
-- No INSERT/UPDATE/DELETE policies: all writes go through the RPCs below.
-- ---------------------------------------------------------------------------
drop policy if exists invites_select_manager on public.invites;
create policy invites_select_manager
  on public.invites
  for select
  to authenticated
  using (public.current_user_role(org_id) in ('owner', 'admin'));

-- ---------------------------------------------------------------------------
-- token generator: 256 bits of randomness as hex, built from core
-- gen_random_uuid() so we don't depend on the pgcrypto extension being enabled.
-- ---------------------------------------------------------------------------
create or replace function public.new_invite_token()
returns text
language sql
volatile
set search_path = ''
as $$
  select replace(gen_random_uuid()::text, '-', '')
       || replace(gen_random_uuid()::text, '-', '');
$$;

revoke execute on function public.new_invite_token() from anon, authenticated, public;

-- ---------------------------------------------------------------------------
-- create_invite(): owner/admin invites an email as admin|member. Upserts the
-- live invite for (org, email) so re-inviting (or re-inviting after expiry)
-- refreshes the token + expiry instead of colliding on the unique index.
-- Returns the row's id + token so the caller can build the accept URL + email.
-- ---------------------------------------------------------------------------
create or replace function public.create_invite(
  p_org   uuid,
  p_email text,
  p_role  text default 'member'
)
returns table (id uuid, token text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_email   text := lower(btrim(p_email));
  v_token   text := public.new_invite_token();
  v_existing uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;
  -- coalesce: current_user_role() is NULL for non-members, and `NULL not in (...)`
  -- is NULL (not true) — without this an outsider would slip past the guard.
  if coalesce(public.current_user_role(p_org), '') not in ('owner', 'admin') then
    raise exception 'Only an owner or admin can invite people'
      using errcode = 'insufficient_privilege';
  end if;
  if p_role not in ('admin', 'member') then
    raise exception 'Role must be admin or member' using errcode = 'check_violation';
  end if;
  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'A valid email is required' using errcode = 'check_violation';
  end if;

  -- Already a member of this org? Nothing to invite.
  if exists (
    select 1
    from public.memberships m
    join public.profiles p on p.id = m.user_id
    where m.org_id = p_org and lower(p.email) = v_email
  ) then
    raise exception 'That person is already a member of this organization'
      using errcode = 'unique_violation';
  end if;

  -- Refresh an existing live invite, or create a new one.
  select i.id into v_existing
  from public.invites i
  where i.org_id = p_org
    and lower(i.email) = v_email
    and i.accepted_at is null
    and i.revoked_at is null;

  if v_existing is not null then
    update public.invites
    set token = v_token,
        role = p_role,
        invited_by = v_uid,
        created_at = now(),
        expires_at = now() + interval '7 days'
    where invites.id = v_existing;
    return query select v_existing, v_token;
  else
    return query
    insert into public.invites (org_id, email, role, token, invited_by)
    values (p_org, v_email, p_role, v_token, v_uid)
    returning invites.id, invites.token;
  end if;
end;
$$;

comment on function public.create_invite(uuid, text, text) is
  'Day 15. Owner/admin invites an email (admin|member); upserts the live invite, returns id + token.';

revoke execute on function public.create_invite(uuid, text, text) from anon, public;
grant  execute on function public.create_invite(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- resend_invite(): owner/admin reissues a fresh token + 7-day expiry for a still
-- pending invite. Returns the new token so the caller can re-send the email.
-- ---------------------------------------------------------------------------
create or replace function public.resend_invite(p_invite uuid)
returns table (id uuid, token text, email text, role text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org   uuid;
  v_token text := public.new_invite_token();
begin
  select i.org_id into v_org from public.invites i where i.id = p_invite;
  if v_org is null then
    raise exception 'Invite not found' using errcode = 'no_data_found';
  end if;
  if coalesce(public.current_user_role(v_org), '') not in ('owner', 'admin') then
    raise exception 'Only an owner or admin can resend invites'
      using errcode = 'insufficient_privilege';
  end if;

  return query
  update public.invites
  set token = v_token, expires_at = now() + interval '7 days'
  where invites.id = p_invite
    and invites.accepted_at is null
    and invites.revoked_at is null
  returning invites.id, invites.token, invites.email, invites.role;

  if not found then
    raise exception 'Invite is no longer pending' using errcode = 'check_violation';
  end if;
end;
$$;

comment on function public.resend_invite(uuid) is
  'Day 15. Owner/admin reissues a pending invite (new token + expiry). Returns token/email/role.';

revoke execute on function public.resend_invite(uuid) from anon, public;
grant  execute on function public.resend_invite(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- revoke_invite(): owner/admin cancels a pending invite. Idempotent-ish: a
-- revoked/accepted invite simply stays as it is.
-- ---------------------------------------------------------------------------
create or replace function public.revoke_invite(p_invite uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  select i.org_id into v_org from public.invites i where i.id = p_invite;
  if v_org is null then
    raise exception 'Invite not found' using errcode = 'no_data_found';
  end if;
  if coalesce(public.current_user_role(v_org), '') not in ('owner', 'admin') then
    raise exception 'Only an owner or admin can revoke invites'
      using errcode = 'insufficient_privilege';
  end if;

  update public.invites
  set revoked_at = now()
  where invites.id = p_invite and invites.accepted_at is null and invites.revoked_at is null;
end;
$$;

comment on function public.revoke_invite(uuid) is
  'Day 15. Owner/admin revokes a pending invite (sets revoked_at).';

revoke execute on function public.revoke_invite(uuid) from anon, public;
grant  execute on function public.revoke_invite(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- accept_invite(): the authenticated invitee redeems a token. Validates the
-- token (exists, not expired/revoked/accepted) and that the signed-in user's
-- email matches the invited email, then adds the membership at the invited role,
-- stamps accepted_at, and switches the user's active org to it. SECURITY DEFINER
-- so the membership INSERT bypasses the member-only Day-11 INSERT policy (this is
-- how an invited *admin* actually gets the admin role). Returns the org_id.
-- ---------------------------------------------------------------------------
create or replace function public.accept_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_email  text := lower((select auth.email()));
  v_invite public.invites%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  select * into v_invite from public.invites where token = p_token;
  if v_invite.id is null then
    raise exception 'This invite link is invalid' using errcode = 'no_data_found';
  end if;
  if v_invite.revoked_at is not null then
    raise exception 'This invite has been revoked' using errcode = 'check_violation';
  end if;
  if v_invite.accepted_at is not null then
    raise exception 'This invite has already been used' using errcode = 'check_violation';
  end if;
  if v_invite.expires_at <= now() then
    raise exception 'This invite has expired' using errcode = 'check_violation';
  end if;
  if lower(v_invite.email) <> v_email then
    raise exception 'This invite was sent to a different email address'
      using errcode = 'check_violation';
  end if;

  -- Add the membership at the invited role (idempotent if somehow already there).
  insert into public.memberships (user_id, org_id, role)
  values (v_uid, v_invite.org_id, v_invite.role)
  on conflict (user_id, org_id) do nothing;

  update public.invites set accepted_at = now() where id = v_invite.id;

  -- Make the joined org the user's active org.
  update public.profiles set current_org_id = v_invite.org_id where id = v_uid;

  return v_invite.org_id;
end;
$$;

comment on function public.accept_invite(text) is
  'Day 15. Authenticated invitee redeems a token: validates + email-matches, adds membership at the invited role, switches active org.';

revoke execute on function public.accept_invite(text) from anon, public;
grant  execute on function public.accept_invite(text) to authenticated;
