-- Day 12 — Org onboarding
-- Closes the gap Day 11 deliberately left open (no user INSERT on organizations).
-- Adds business identity to organizations, an org_settings table for seeded
-- defaults, a server-authoritative active org (profiles.current_org_id), and two
-- SECURITY DEFINER RPCs that are the only user-facing create/finish-onboarding
-- paths — so RLS stays intact while users can create orgs and complete a wizard.
--
-- Applied to the live DB via Supabase MCP execute_sql (NOT apply_migration) to
-- keep Supabase's own migration history clean; this file is the repo source of truth.

-- ---------------------------------------------------------------------------
-- organizations: add business identity + an onboarding marker.
-- size is constrained; both stay NULLable because the signup trigger creates a
-- bare personal org before the owner has filled anything in. onboarded_at NULL
-- means "still needs the first-run wizard".
-- ---------------------------------------------------------------------------
alter table public.organizations
  add column if not exists industry     text,
  add column if not exists size         text
    check (size in ('1', '2-10', '11-50', '51-200', '200+')),
  add column if not exists onboarded_at timestamptz;

comment on column public.organizations.onboarded_at is
  'Day 12. NULL until the owner completes the onboarding wizard; gates /onboarding.';

-- ---------------------------------------------------------------------------
-- org_settings: one row per org for seeded, mutable defaults. Identity lives on
-- organizations; preferences live here. RLS: members read, owners/admins update.
-- No user INSERT/DELETE — rows are created by RPC/trigger and removed by cascade.
-- ---------------------------------------------------------------------------
create table if not exists public.org_settings (
  org_id        uuid primary key references public.organizations (id) on delete cascade,
  timezone      text not null default 'America/Toronto',
  locale        text not null default 'en-CA',
  notifications jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.org_settings is
  'Day 12. Per-org seeded defaults (timezone/locale/notifications). RLS: member read, owner/admin update.';

alter table public.org_settings enable row level security;

drop trigger if exists org_settings_set_updated_at on public.org_settings;
create trigger org_settings_set_updated_at
  before update on public.org_settings
  for each row execute function public.set_updated_at();

drop policy if exists org_settings_select_member on public.org_settings;
create policy org_settings_select_member
  on public.org_settings
  for select
  to authenticated
  using (org_id in (select public.current_user_orgs()));

drop policy if exists org_settings_update_admin on public.org_settings;
create policy org_settings_update_admin
  on public.org_settings
  for update
  to authenticated
  using (public.current_user_role(org_id) in ('owner', 'admin'))
  with check (public.current_user_role(org_id) in ('owner', 'admin'));

-- ---------------------------------------------------------------------------
-- profiles.current_org_id: the user's active org (server-authoritative; survives
-- across devices). ON DELETE SET NULL so deleting an org doesn't orphan the row;
-- callers fall back to the first membership when NULL.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists current_org_id uuid references public.organizations (id) on delete set null;

comment on column public.profiles.current_org_id is
  'Day 12. The user''s active org for the switcher. NULL → fall back to first membership.';

-- ---------------------------------------------------------------------------
-- Guard: a user may only point current_org_id at an org they belong to.
-- The Day-11 profiles_update_self policy already restricts WHO can update the
-- row; this trigger restricts the VALUE. SECURITY DEFINER so the membership
-- check is exact regardless of the caller's visibility.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_current_org_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.current_org_id is not null
     and not exists (
       select 1 from public.memberships
       where user_id = new.id and org_id = new.current_org_id
     ) then
    raise exception 'current_org_id % is not an org the user belongs to', new.current_org_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

comment on function public.enforce_current_org_membership() is
  'Day 12. Ensures profiles.current_org_id always references one of the user''s orgs.';

revoke execute on function public.enforce_current_org_membership() from anon, authenticated, public;

drop trigger if exists profiles_enforce_current_org on public.profiles;
create trigger profiles_enforce_current_org
  before insert or update of current_org_id on public.profiles
  for each row execute function public.enforce_current_org_membership();

-- ---------------------------------------------------------------------------
-- create_organization(): the user-facing create path Day 11 withheld. Creates an
-- org (already onboarded — the form carried the details), an owner membership for
-- the caller, a default settings row, and switches the caller's active org to it.
-- SECURITY DEFINER so it can write organizations/memberships (no user INSERT
-- policy) while still being scoped to auth.uid().
-- ---------------------------------------------------------------------------
create or replace function public.create_organization(
  p_name     text,
  p_industry text default null,
  p_size     text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_base text;
  v_slug text;
  v_org  uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'Organization name is required' using errcode = 'check_violation';
  end if;

  v_base := trim(both '-' from regexp_replace(lower(p_name), '[^a-z0-9]+', '-', 'g'));
  if v_base = '' then
    v_base := 'workspace';
  end if;
  v_slug := v_base || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  insert into public.organizations (name, slug, industry, size, created_by, onboarded_at)
  values (btrim(p_name), v_slug, p_industry, p_size, v_uid, now())
  returning id into v_org;

  insert into public.memberships (user_id, org_id, role)
  values (v_uid, v_org, 'owner');

  insert into public.org_settings (org_id) values (v_org);

  update public.profiles set current_org_id = v_org where id = v_uid;

  return v_org;
end;
$$;

comment on function public.create_organization(text, text, text) is
  'Day 12. User-facing create-org RPC: org + owner membership + settings + active-org switch.';

revoke execute on function public.create_organization(text, text, text) from anon, public;
grant  execute on function public.create_organization(text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- complete_org_onboarding(): finish the first-run wizard for the auto-provisioned
-- personal org. Owner-only; fills identity, stamps onboarded_at, ensures a
-- settings row, and makes it the active org.
-- ---------------------------------------------------------------------------
create or replace function public.complete_org_onboarding(
  p_org      uuid,
  p_name     text,
  p_industry text default null,
  p_size     text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;
  if not exists (
    select 1 from public.memberships
    where user_id = v_uid and org_id = p_org and role = 'owner'
  ) then
    raise exception 'Only an owner can complete onboarding for organization %', p_org
      using errcode = 'insufficient_privilege';
  end if;
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'Organization name is required' using errcode = 'check_violation';
  end if;

  update public.organizations
  set name = btrim(p_name), industry = p_industry, size = p_size, onboarded_at = now()
  where id = p_org;

  insert into public.org_settings (org_id) values (p_org)
  on conflict (org_id) do nothing;

  update public.profiles set current_org_id = p_org where id = v_uid;
end;
$$;

comment on function public.complete_org_onboarding(uuid, text, text, text) is
  'Day 12. Owner-only: finish the first-run wizard on the auto-provisioned personal org.';

revoke execute on function public.complete_org_onboarding(uuid, text, text, text) from anon, public;
grant  execute on function public.complete_org_onboarding(uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Refresh handle_new_user(): every personal org now also gets a settings row and
-- becomes the new user's active org. (Org stays un-onboarded → first-run wizard.)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_local text;
  v_slug  text;
  v_org   uuid;
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;

  v_local := lower(split_part(new.email, '@', 1));
  v_slug  := trim(both '-' from regexp_replace(v_local, '[^a-z0-9]+', '-', 'g'));
  if v_slug = '' then
    v_slug := 'workspace';
  end if;
  v_slug := v_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  insert into public.organizations (name, slug, created_by)
  values (split_part(new.email, '@', 1) || '''s workspace', v_slug, new.id)
  returning id into v_org;

  insert into public.memberships (user_id, org_id, role)
  values (new.id, v_org, 'owner');

  insert into public.org_settings (org_id) values (v_org);

  update public.profiles set current_org_id = v_org where id = new.id;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from anon, authenticated, public;

-- ---------------------------------------------------------------------------
-- Backfill: existing orgs get a settings row; existing profiles get an active
-- org (their first/only membership) if they don't have one. Idempotent.
-- ---------------------------------------------------------------------------
insert into public.org_settings (org_id)
select o.id
from public.organizations o
where not exists (select 1 from public.org_settings s where s.org_id = o.id);

update public.profiles p
set current_org_id = m.org_id
from (
  select distinct on (user_id) user_id, org_id
  from public.memberships
  order by user_id, created_at
) m
where m.user_id = p.id and p.current_org_id is null;
