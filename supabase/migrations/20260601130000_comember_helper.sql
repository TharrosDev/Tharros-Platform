-- Audit fix #4 — Flatten the profiles co-member SELECT policy
-- The Day-11 profiles_select_self_or_comember policy evaluated a double
-- memberships self-join (itself RLS-governed) per candidate profiles row, which
-- gets expensive at scale. This replaces the inline EXISTS with a SECURITY
-- DEFINER set-returning helper (mirroring current_user_orgs(), tenant_model.sql)
-- so the policy becomes a flat `id in (select ...)`. Pure refactor — identical
-- visibility semantics (self + co-members), validated by the existing Day-11
-- RLS harness (apps/web/src/lib/supabase/__tests__/rls.test.ts).
--
-- Applied to the live DB via Supabase MCP execute_sql (NOT apply_migration) to
-- keep Supabase's own migration history clean; this file is the repo source of
-- truth. Must also be applied to the CI test project (psunqcyzjcmfgcrnowdl).

-- ---------------------------------------------------------------------------
-- current_user_comember_ids(): user_ids that share at least one org with the
-- caller (includes the caller). SECURITY DEFINER so it reads memberships without
-- tripping that table's RLS or recursing through the profiles policy that calls
-- it. search_path pinned + objects schema-qualified per the advisor. Kept
-- executable by `authenticated` (like current_user_orgs) so the policy can call
-- it; revoked from anon/public.
-- ---------------------------------------------------------------------------
create or replace function public.current_user_comember_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select distinct m_other.user_id
  from public.memberships m_self
  join public.memberships m_other on m_other.org_id = m_self.org_id
  where m_self.user_id = (select auth.uid());
$$;

comment on function public.current_user_comember_ids() is
  'Audit fix #4. user_ids sharing an org with the caller (incl. self). Used by the profiles SELECT policy.';

revoke execute on function public.current_user_comember_ids() from anon, public;

-- ---------------------------------------------------------------------------
-- Recreate the profiles SELECT policy on top of the helper. Supersedes the
-- inline-join definition in 20260531200000_rls_policies.sql; semantics unchanged.
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select_self_or_comember on public.profiles;
create policy profiles_select_self_or_comember
  on public.profiles
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or id in (select public.current_user_comember_ids())
  );
