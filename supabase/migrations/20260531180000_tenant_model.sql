-- Day 10 — Multi-tenant data model
-- Establishes the canonical tenant schema: profiles, organizations, memberships,
-- a current_user_orgs() helper, and an auto-provision trigger on auth.users that
-- gives every new signup a profile + a personal organization + an owner membership.
--
-- RLS is ENABLED on every new table but NO policies are added here (deny-all).
-- Access policies are Day 11. This file is the repo source of truth; it is applied
-- to the live DB via the Supabase MCP execute_sql (not apply_migration) to avoid
-- polluting Supabase's own migration history, per the project convention.

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user (app-facing identity)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  full_name  text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

comment on table public.profiles is
  'Day 10. App-facing user identity, 1:1 with auth.users. RLS on; policies are Day 11.';

-- ---------------------------------------------------------------------------
-- organizations: the tenant. Every domain table will carry org_id.
-- ---------------------------------------------------------------------------
create table if not exists public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

alter table public.organizations enable row level security;

comment on table public.organizations is
  'Day 10. The tenant. Every domain table carries org_id. RLS on; policies are Day 11.';

-- ---------------------------------------------------------------------------
-- memberships: which users belong to which orgs, and in what role
-- ---------------------------------------------------------------------------
create table if not exists public.memberships (
  user_id    uuid not null references auth.users (id) on delete cascade,
  org_id     uuid not null references public.organizations (id) on delete cascade,
  role       text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (user_id, org_id)
);

alter table public.memberships enable row level security;

create index if not exists memberships_org_id_idx on public.memberships (org_id);

comment on table public.memberships is
  'Day 10. user<->org join with role. RLS on; policies are Day 11.';

-- ---------------------------------------------------------------------------
-- current_user_orgs(): org_ids the calling user belongs to.
-- Day 11 RLS policies reuse this. SECURITY DEFINER so it can read memberships
-- regardless of (future) RLS on that table; search_path pinned + objects
-- fully qualified to satisfy the security advisor.
-- ---------------------------------------------------------------------------
create or replace function public.current_user_orgs()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select org_id from public.memberships where user_id = (select auth.uid());
$$;

comment on function public.current_user_orgs() is
  'Day 10. Returns org_ids the calling user belongs to. Reused by Day 11 RLS policies.';

-- ---------------------------------------------------------------------------
-- handle_new_user(): auto-provision a profile + personal org + owner membership
-- whenever a new auth.users row is created. SECURITY DEFINER (runs as table
-- owner) because the brand-new user has no rights yet; search_path pinned.
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
  -- profile (idempotent)
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;

  -- derive a human-ish slug from the email local-part + a random suffix
  v_local := lower(split_part(new.email, '@', 1));
  v_slug  := trim(both '-' from regexp_replace(v_local, '[^a-z0-9]+', '-', 'g'));
  if v_slug = '' then
    v_slug := 'workspace';
  end if;
  v_slug := v_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  -- personal organization
  insert into public.organizations (name, slug, created_by)
  values (split_part(new.email, '@', 1) || '''s workspace', v_slug, new.id)
  returning id into v_org;

  -- owner membership
  insert into public.memberships (user_id, org_id, role)
  values (new.id, v_org, 'owner');

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Day 10. On new auth.users row: create profile + personal org + owner membership.';

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Backfill: any existing auth user with no membership gets the same treatment
-- (the trigger only fires on future inserts). Idempotent.
-- ---------------------------------------------------------------------------
do $$
declare
  u record;
  v_local text;
  v_slug  text;
  v_org   uuid;
begin
  for u in
    select au.id, au.email, au.raw_user_meta_data
    from auth.users au
    where not exists (select 1 from public.memberships m where m.user_id = au.id)
  loop
    insert into public.profiles (id, email, full_name)
    values (u.id, u.email, u.raw_user_meta_data ->> 'full_name')
    on conflict (id) do nothing;

    v_local := lower(split_part(u.email, '@', 1));
    v_slug  := trim(both '-' from regexp_replace(v_local, '[^a-z0-9]+', '-', 'g'));
    if v_slug = '' then
      v_slug := 'workspace';
    end if;
    v_slug := v_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

    insert into public.organizations (name, slug, created_by)
    values (split_part(u.email, '@', 1) || '''s workspace', v_slug, u.id)
    returning id into v_org;

    insert into public.memberships (user_id, org_id, role)
    values (u.id, v_org, 'owner');
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Lock down the SECURITY DEFINER functions exposed via PostgREST RPC.
-- handle_new_user() is a trigger function only — no role should call it.
-- current_user_orgs() must stay executable by `authenticated` because Day 11
-- RLS policies evaluate it as that role; only revoke the anon/public surface.
-- ---------------------------------------------------------------------------
revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.current_user_orgs() from anon, public;
