-- Day 23 — Document storage + model (Phase 2 / AI Assistant + RAG foundation)
-- Lays the data + storage layer the rest of Phase 2 builds on. No UI (Day 24),
-- no text extraction (Day 25), no chunking/embedding (Day 26), no retrieval
-- (Day 27) yet — this migration only creates the schema, the private Storage
-- bucket, and the RLS that keeps every byte org-scoped.
--
-- Tables:
--   * documents        — one row per uploaded file; tracks pipeline status.
--   * document_chunks   — vector store (populated Day 26). embedding is
--                         vector(1536) to match text-embedding-3-small, the
--                         cheap default; swappable later by re-embedding. The
--                         ANN index (HNSW/IVFFlat) is deliberately deferred to
--                         Day 27 (vector retrieval) where recall is tuned.
--   * ingestion_jobs    — tracks the extract -> chunk -> embed pipeline; rows
--                         are written by the server/ingestion job (service role).
--
-- RLS model (mirrors the Day-10/11 tenant pattern):
--   * Reads are org-scoped via public.current_user_orgs().
--   * documents: org members may insert/update/delete their own org's docs
--     (current_user_role(org_id) is not null). Upload is a member action; per-role
--     caps can come with Day 33 cost controls.
--   * document_chunks + ingestion_jobs: authenticated users get SELECT only
--     (org-scoped). Writes happen through the service-role client (bypasses RLS)
--     in the Day-26 ingestion job — same pattern as subscriptions/stripe_events.
--   * storage.objects in bucket 'documents': scoped by the first path segment
--     (= org_id) so a user can only touch files under an org folder they belong
--     to. Path convention: '<org_id>/<document_id>/<filename>'.
--
-- Applied to the live DB via Supabase MCP execute_sql (NOT apply_migration) to
-- keep Supabase's own migration history clean; this file is the repo source of
-- truth. Apply to BOTH prod (inxhrijqyxvwoeqczbrl) and the CI test project
-- (psunqcyzjcmfgcrnowdl) so the schemas stay in lockstep.

-- pgvector is already installed in schema `extensions` (v0.8.0); idempotent guard.
create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------------
-- documents: one row per uploaded file
-- ---------------------------------------------------------------------------
create table if not exists public.documents (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  uploaded_by  uuid references auth.users (id) on delete set null,
  storage_path text not null,
  filename     text not null,
  mime_type    text,
  size_bytes   bigint,
  status       text not null default 'uploaded'
                 check (status in ('uploaded','extracting','chunking','embedding','ready','failed')),
  error        text,
  created_at   timestamptz not null default now()
);

alter table public.documents enable row level security;

create index if not exists documents_org_id_idx on public.documents (org_id);

comment on table public.documents is
  'Day 23. One row per uploaded file. org-scoped via RLS; pipeline status tracked
   in `status`. Bytes live in the private `documents` Storage bucket at storage_path.';

-- ---------------------------------------------------------------------------
-- document_chunks: vector store (populated Day 26, queried Day 27)
-- ---------------------------------------------------------------------------
create table if not exists public.document_chunks (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  org_id      uuid not null references public.organizations (id) on delete cascade,
  chunk_index int not null,
  content     text not null,
  token_count int,
  metadata    jsonb not null default '{}'::jsonb,
  embedding   extensions.vector(1536),
  created_at  timestamptz not null default now(),
  unique (document_id, chunk_index)
);

alter table public.document_chunks enable row level security;

create index if not exists document_chunks_document_id_idx on public.document_chunks (document_id);

-- NOTE: no ANN (HNSW/IVFFlat) index on `embedding` here — that is Day 27 (vector
-- retrieval), where recall/index params are tuned against a real test corpus.
-- org_id is denormalized for cheap org-scoped RLS + the Day-27 retrieval filter.
comment on table public.document_chunks is
  'Day 23. Chunked + embedded slices of a document (populated Day 26). embedding
   vector(1536) = text-embedding-3-small default. ANN index deferred to Day 27.';

-- ---------------------------------------------------------------------------
-- ingestion_jobs: tracks the extract -> chunk -> embed pipeline
-- ---------------------------------------------------------------------------
create table if not exists public.ingestion_jobs (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  org_id      uuid not null references public.organizations (id) on delete cascade,
  status      text not null default 'queued'
                check (status in ('queued','running','succeeded','failed')),
  stage       text,
  attempts    int not null default 0,
  error       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.ingestion_jobs enable row level security;

create index if not exists ingestion_jobs_document_id_idx on public.ingestion_jobs (document_id);
create index if not exists ingestion_jobs_status_idx on public.ingestion_jobs (status);

comment on table public.ingestion_jobs is
  'Day 23. Tracks the extract->chunk->embed pipeline per document (driven Day 25/26).
   Written by the service-role ingestion job; authenticated users get SELECT only.';

-- ---------------------------------------------------------------------------
-- RLS policies — documents (org members manage their org's docs)
-- ---------------------------------------------------------------------------
drop policy if exists documents_select_member on public.documents;
create policy documents_select_member
  on public.documents
  for select
  to authenticated
  using (org_id in (select public.current_user_orgs()));

drop policy if exists documents_insert_member on public.documents;
create policy documents_insert_member
  on public.documents
  for insert
  to authenticated
  with check (public.current_user_role(org_id) is not null);

drop policy if exists documents_update_member on public.documents;
create policy documents_update_member
  on public.documents
  for update
  to authenticated
  using (public.current_user_role(org_id) is not null)
  with check (public.current_user_role(org_id) is not null);

drop policy if exists documents_delete_member on public.documents;
create policy documents_delete_member
  on public.documents
  for delete
  to authenticated
  using (public.current_user_role(org_id) is not null);

-- ---------------------------------------------------------------------------
-- RLS policies — document_chunks (member read; service-role writes)
-- ---------------------------------------------------------------------------
drop policy if exists document_chunks_select_member on public.document_chunks;
create policy document_chunks_select_member
  on public.document_chunks
  for select
  to authenticated
  using (org_id in (select public.current_user_orgs()));

-- No INSERT/UPDATE/DELETE policy: chunks are written by the Day-26 ingestion job
-- via the service-role client (bypasses RLS).

-- ---------------------------------------------------------------------------
-- RLS policies — ingestion_jobs (member read; service-role writes)
-- ---------------------------------------------------------------------------
drop policy if exists ingestion_jobs_select_member on public.ingestion_jobs;
create policy ingestion_jobs_select_member
  on public.ingestion_jobs
  for select
  to authenticated
  using (org_id in (select public.current_user_orgs()));

-- No INSERT/UPDATE/DELETE policy: jobs are driven by the service-role client.

-- ---------------------------------------------------------------------------
-- Storage — private `documents` bucket + org-folder-scoped object RLS
-- First Storage use in the repo. Files live at '<org_id>/<document_id>/<filename>';
-- the first path segment is the org_id, matched against current_user_orgs().
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

drop policy if exists documents_objects_select_member on storage.objects;
create policy documents_objects_select_member
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1]::uuid in (select public.current_user_orgs())
  );

drop policy if exists documents_objects_insert_member on storage.objects;
create policy documents_objects_insert_member
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1]::uuid in (select public.current_user_orgs())
  );

drop policy if exists documents_objects_update_member on storage.objects;
create policy documents_objects_update_member
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1]::uuid in (select public.current_user_orgs())
  )
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1]::uuid in (select public.current_user_orgs())
  );

drop policy if exists documents_objects_delete_member on storage.objects;
create policy documents_objects_delete_member
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1]::uuid in (select public.current_user_orgs())
  );
