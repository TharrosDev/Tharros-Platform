-- Audit follow-up — cover the invites.invited_by foreign key with an index.
-- The `unindexed_foreign_keys` performance advisor flagged `invites_invited_by_fkey`
-- (invites.invited_by → auth.users) as lacking a covering index. Without it, a
-- delete/update on the referenced user must seq-scan invites to check the FK, and
-- lookups by inviter are unindexed. Low impact at current volume; cheap to fix.
--
-- Applied to the live DB via Supabase MCP execute_sql (NOT apply_migration) to
-- keep Supabase's own migration history clean; this file is the repo source of
-- truth. Applied to BOTH prod (inxhrijqyxvwoeqczbrl) and the CI test project
-- (psunqcyzjcmfgcrnowdl) so the schemas stay in lockstep.

create index if not exists invites_invited_by_idx
  on public.invites (invited_by);
