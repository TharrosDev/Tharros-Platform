-- Day 12 — follow-up: index the profiles.current_org_id foreign key.
--
-- Postgres does not auto-index FK columns. profiles.current_org_id is declared
-- `on delete set null`, so deleting an organization scans profiles to clear the
-- pointer; without an index that is a seq scan on profiles per org delete. The
-- index also covers the (rarer) "who has this org active" lookups.
--
-- Applied to the live DB via Supabase MCP execute_sql (repo source of truth).

create index if not exists profiles_current_org_id_idx
  on public.profiles (current_org_id);
