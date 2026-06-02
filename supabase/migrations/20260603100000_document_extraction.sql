-- Day 25 — Text extraction
-- Day 24 uploads land at documents.status = 'uploaded'. Day 25 parses the bytes
-- (PDF/DOCX/TXT/MD) into text so Day 26 can chunk + embed them. This migration
-- adds the columns that hold the extracted text + counts and extends the status
-- lifecycle with two new terminal-for-now states:
--   * 'extracted'  — text pulled successfully; awaiting Day-26 chunk/embed.
--   * 'needs_ocr'  — a scanned/image-only PDF yielded ~no text; flagged for a
--                    future OCR pass (Tesseract, self-hosted, deferred).
-- New lifecycle: uploaded -> extracting -> extracted | needs_ocr | failed,
-- and Day 26 will drive extracted -> chunking -> embedding -> ready.
--
-- Applied to the live DB via Supabase MCP execute_sql (NOT apply_migration) to
-- keep Supabase's own migration history clean; this file is the repo source of
-- truth. Apply to BOTH prod (inxhrijqyxvwoeqczbrl) and the CI test project
-- (psunqcyzjcmfgcrnowdl) so the schemas stay in lockstep.

alter table public.documents
  add column if not exists extracted_text text,
  add column if not exists char_count    int,
  add column if not exists page_count     int,
  add column if not exists extracted_at   timestamptz;

-- Extend the status CHECK to add 'extracted' + 'needs_ocr'. Drop the old
-- constraint by its conventional name first (idempotent).
alter table public.documents
  drop constraint if exists documents_status_check;

alter table public.documents
  add constraint documents_status_check
  check (status in (
    'uploaded', 'extracting', 'extracted', 'chunking', 'embedding', 'ready', 'needs_ocr', 'failed'
  ));

comment on column public.documents.extracted_text is
  'Day 25. Full extracted text (PDF/DOCX/TXT/MD). Source for Day-26 chunking. Not
   selected by the document-list read path.';
comment on column public.documents.char_count is 'Day 25. Non-whitespace-aware length of extracted_text.';
comment on column public.documents.page_count is 'Day 25. PDF page count when known, else null.';
