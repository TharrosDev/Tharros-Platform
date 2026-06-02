-- Day 21 — Account & org settings
-- The only schema change Day 21 needs. Account deletion (PIPEDA right-to-erasure)
-- removes the auth.users row via the service-role admin client; that cascades to
-- profiles + memberships (both ON DELETE CASCADE) but is BLOCKED by
-- organizations.created_by, which referenced auth.users(id) with the default
-- NO ACTION. Any org the user created (even one they've since left, or a
-- co-owned org that must outlive them) would prevent the delete.
--
-- Make created_by ON DELETE SET NULL: deleting a user simply forgets who created
-- their surviving orgs (the membership/ownership model is the source of truth for
-- access, not created_by). Sole-owned orgs are deleted explicitly by the
-- deleteAccount action before the user row is removed.
--
-- Notification preferences reuse the existing org_settings.notifications jsonb
-- (Day 12) — no schema change there.
--
-- Applied to the live DB via Supabase MCP execute_sql (NOT apply_migration) to
-- keep Supabase's own migration history clean; this file is the repo source of
-- truth. Apply to BOTH prod (inxhrijqyxvwoeqczbrl) and the CI test project
-- (psunqcyzjcmfgcrnowdl) so the schemas stay in lockstep.

alter table public.organizations
  drop constraint if exists organizations_created_by_fkey;

alter table public.organizations
  add constraint organizations_created_by_fkey
  foreign key (created_by) references auth.users (id) on delete set null;

comment on constraint organizations_created_by_fkey on public.organizations is
  'Day 21. ON DELETE SET NULL so deleting an auth user (account erasure) does not
   leave a dangling FK; access is governed by memberships, not created_by.';
