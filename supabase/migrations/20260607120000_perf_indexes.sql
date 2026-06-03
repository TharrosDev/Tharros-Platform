-- Perf — composite indexes backing the org-scoped, ordered list reads.
--
-- Two hot list queries filter by org and sort by a timestamp, but the existing
-- single-column indexes only satisfy the filter, leaving Postgres to sort the
-- matched rows in memory on every page load. These composites make each an
-- index-ordered scan and also back keyset/cursor pagination (limit + a
-- (sort_col, id) cursor) when that lands.
--
--   listDocuments      : documents     WHERE org_id = ? ORDER BY created_at DESC
--                        (had documents_org_id_idx only → in-memory sort)
--   listConversations  : conversations WHERE org_id = ? ORDER BY updated_at DESC
--                        (the owner-sees-all view; the existing
--                         (org_id, user_id, updated_at desc) index can't serve
--                         this sort because user_id sits between the equality
--                         column and the ORDER BY column)
--
-- messages already has the ideal (conversation_id, created_at) composite, so no
-- change there. Non-destructive (`if not exists`); tables are tiny today so a
-- plain CREATE INDEX is instant — use CREATE INDEX CONCURRENTLY if ever applied
-- against a large, live table.
--
-- Applied to the live DB + the CI test project via Supabase MCP execute_sql
-- (repo source of truth).

create index if not exists documents_org_created_idx
  on public.documents (org_id, created_at desc);

create index if not exists conversations_org_updated_idx
  on public.conversations (org_id, updated_at desc);
