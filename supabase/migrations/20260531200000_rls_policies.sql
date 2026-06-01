-- Day 11 — Row-Level Security
-- Turns the Day-10 tenant tables (profiles, organizations, memberships) from
-- deny-all into a working, role-aware access model that guarantees cross-tenant
-- isolation. Reuses the Day-10 current_user_orgs() helper and adds a
-- current_user_role() helper plus a last-owner invariant guard.
--
-- Role model (decided Day 11):
--   * Reads are org-scoped: you see only rows in orgs you belong to.
--   * profiles: you see yourself + co-members; you edit only yourself.
--   * organizations: owners update/delete; no user INSERT (signup trigger is the
--     sole creator until Day 12 adds an onboarding create-org RPC).
--   * memberships: owners/admins add plain members; ONLY owners change roles;
--     owners/admins remove members, anyone can leave; the last owner is protected.
--
-- Applied to the live DB via Supabase MCP execute_sql (NOT apply_migration) to
-- keep Supabase's own migration history clean; this file is the repo source of
-- truth. RLS was already enabled on all three tables in the Day-10 migration.

-- ---------------------------------------------------------------------------
-- Helper: the caller's role in a given org (or NULL if not a member).
-- SECURITY DEFINER so it reads memberships without tripping that table's own
-- RLS (and without recursion — it is not itself governed by a policy that calls
-- it). search_path pinned + everything schema-qualified per the advisor.
-- ---------------------------------------------------------------------------
create or replace function public.current_user_role(p_org uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role
  from public.memberships
  where user_id = (select auth.uid()) and org_id = p_org;
$$;

comment on function public.current_user_role(uuid) is
  'Day 11. Returns the calling user''s role in p_org (owner/admin/member) or NULL. Used by RLS write policies.';

revoke execute on function public.current_user_role(uuid) from anon, public;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select_self_or_comember on public.profiles;
create policy profiles_select_self_or_comember
  on public.profiles
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1
      from public.memberships m_self
      join public.memberships m_other on m_other.org_id = m_self.org_id
      where m_self.user_id = (select auth.uid())
        and m_other.user_id = public.profiles.id
    )
  );

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- No INSERT/DELETE policy: rows are created by the signup trigger and removed by
-- cascade from auth.users.

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------
drop policy if exists organizations_select_member on public.organizations;
create policy organizations_select_member
  on public.organizations
  for select
  to authenticated
  using (id in (select public.current_user_orgs()));

drop policy if exists organizations_update_owner on public.organizations;
create policy organizations_update_owner
  on public.organizations
  for update
  to authenticated
  using (public.current_user_role(id) = 'owner')
  with check (public.current_user_role(id) = 'owner');

drop policy if exists organizations_delete_owner on public.organizations;
create policy organizations_delete_owner
  on public.organizations
  for delete
  to authenticated
  using (public.current_user_role(id) = 'owner');

-- No INSERT policy: the signup trigger is the only creator until Day 12.

-- ---------------------------------------------------------------------------
-- memberships
-- ---------------------------------------------------------------------------
drop policy if exists memberships_select_comember on public.memberships;
create policy memberships_select_comember
  on public.memberships
  for select
  to authenticated
  using (org_id in (select public.current_user_orgs()));

-- Owners/admins may add PLAIN members. Promoting beyond 'member' is owners-only
-- and happens via UPDATE, so INSERT is constrained to role = 'member'.
drop policy if exists memberships_insert_admin_member on public.memberships;
create policy memberships_insert_admin_member
  on public.memberships
  for insert
  to authenticated
  with check (
    public.current_user_role(org_id) in ('owner', 'admin')
    and role = 'member'
  );

-- Role changes are owners-only (prevents admin self-escalation).
drop policy if exists memberships_update_owner on public.memberships;
create policy memberships_update_owner
  on public.memberships
  for update
  to authenticated
  using (public.current_user_role(org_id) = 'owner')
  with check (public.current_user_role(org_id) = 'owner');

-- Owners remove anyone; admins remove plain members; anyone may remove
-- themselves (leave the org). The last-owner guard below is the backstop.
drop policy if exists memberships_delete_owner_admin_or_self on public.memberships;
create policy memberships_delete_owner_admin_or_self
  on public.memberships
  for delete
  to authenticated
  using (
    public.current_user_role(org_id) = 'owner'
    or (public.current_user_role(org_id) = 'admin' and role = 'member')
    or user_id = (select auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Invariant guard: an org must never lose its last owner. RLS expresses this
-- poorly, so enforce it in a trigger that runs regardless of which policy let
-- the statement through. SECURITY DEFINER so the owner count is exact even when
-- the actor cannot see all rows.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_membership_invariants()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org   uuid;
  v_was_owner boolean;
  v_owner_count int;
begin
  if tg_op = 'DELETE' then
    v_org := old.org_id;
    v_was_owner := old.role = 'owner';
  elsif tg_op = 'UPDATE' then
    v_org := old.org_id;
    -- Only a transition AWAY from owner can drop the owner count.
    v_was_owner := old.role = 'owner' and new.role <> 'owner';
  end if;

  -- Skip the guard when the org itself is going away: deleting an organization
  -- cascades to its memberships, and at that point the parent row is already
  -- gone, so blocking the last-owner removal would make org deletion impossible.
  if v_was_owner and exists (select 1 from public.organizations where id = v_org) then
    select count(*) into v_owner_count
    from public.memberships
    where org_id = v_org and role = 'owner';
    -- v_owner_count still includes the row being removed/demoted.
    if v_owner_count <= 1 then
      raise exception 'Cannot remove or demote the last owner of organization %', v_org
        using errcode = 'check_violation';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

comment on function public.enforce_membership_invariants() is
  'Day 11. Blocks removing/demoting the last owner of an org. Defense-in-depth beside the RLS policies.';

-- Trigger-only function — must never be callable via PostgREST RPC.
revoke execute on function public.enforce_membership_invariants() from anon, authenticated, public;

drop trigger if exists enforce_membership_invariants on public.memberships;
create trigger enforce_membership_invariants
  before update or delete on public.memberships
  for each row execute function public.enforce_membership_invariants();
