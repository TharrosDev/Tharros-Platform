-- Day 51 — Approval & publish flow: distinguish published snapshots from candidates.
--
-- Day 49 fills `schedule_versions` with the candidate panel's weighting variants.
-- Day 51 reuses the same table to store an immutable snapshot of the shift set
-- each time a schedule is *published* (label `published-v{n}`, `assignments` = the
-- published shifts, coverage summary in `score`/`covered`/`total_missing`, the
-- manager's approval note in `note`). The new `source` column tells the two apart
-- so the dashboard can list publish history separately from generation candidates.
--
-- Rides the existing Day-41 member-read / manager-write RLS on the table.

alter table public.schedule_versions
  add column if not exists source text not null default 'candidate'
    check (source in ('candidate', 'published'));

comment on column public.schedule_versions.source is
  'Day 51. ''candidate'' = a Day-49 panel weighting variant; ''published'' = an immutable snapshot taken at publish time.';
