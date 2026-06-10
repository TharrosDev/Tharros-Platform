-- Advisor-driven tuning pass (Supabase performance + security linters, 2026-06-09).
--
-- 1) Covering indexes for every flagged unindexed foreign key. Cheap on these
--    table sizes, and they matter for org/user cascade deletes (account
--    deletion fans out across every org_id / user_id FK) and reverse lookups.
-- 2) Drop the broad public-read listing policy on the avatars bucket — public
--    buckets serve object URLs without any SELECT policy; the policy only
--    enabled listing the whole bucket via the Storage API.
-- 3) Move pg_net out of the public schema (security lint 0014).
--
-- Intentionally NOT acted on:
-- - rls_enabled_no_policy on jobs / stripe_events / rate_limit_events /
--   agent_audit_log — deny-all by design, service-role only.
-- - authenticated-executable SECURITY DEFINER RPCs — each role-checks
--   internally; anon validate_portal_token is the portal door and anon
--   check_rate_limit guards login/signup.
-- - "Unused index" lints — the database is days old; those indexes back
--   pagination/search paths that simply haven't seen traffic yet.

-- 1) Foreign-key covering indexes -------------------------------------------

create index if not exists agent_audit_log_turn_id_idx on public.agent_audit_log (turn_id);
create index if not exists agent_turns_org_id_idx on public.agent_turns (org_id);
create index if not exists ai_conversation_threads_created_by_idx on public.ai_conversation_threads (created_by);
create index if not exists ai_conversation_threads_taken_over_by_idx on public.ai_conversation_threads (taken_over_by);
create index if not exists ai_usage_events_user_id_idx on public.ai_usage_events (user_id);
create index if not exists conversations_user_id_idx on public.conversations (user_id);
create index if not exists document_chunks_org_id_idx on public.document_chunks (org_id);
create index if not exists documents_uploaded_by_idx on public.documents (uploaded_by);
create index if not exists employee_portal_tokens_org_id_idx on public.employee_portal_tokens (org_id);
create index if not exists ingestion_jobs_org_id_idx on public.ingestion_jobs (org_id);
create index if not exists jobs_org_id_idx on public.jobs (org_id);
create index if not exists messages_org_id_idx on public.messages (org_id);
create index if not exists replacement_pool_events_sick_call_id_idx on public.replacement_pool_events (sick_call_id);
create index if not exists schedules_created_by_idx on public.schedules (created_by);
create index if not exists shift_swap_requests_requesting_employee_id_idx on public.shift_swap_requests (requesting_employee_id);
create index if not exists shift_swap_requests_reviewed_by_idx on public.shift_swap_requests (reviewed_by);
create index if not exists shift_swap_requests_target_employee_id_idx on public.shift_swap_requests (target_employee_id);
create index if not exists shifts_role_certification_id_idx on public.shifts (role_certification_id);
create index if not exists sick_call_events_employee_id_idx on public.sick_call_events (employee_id);
create index if not exists staffing_requirements_role_certification_id_idx on public.staffing_requirements (role_certification_id);
create index if not exists time_off_requests_reviewed_by_idx on public.time_off_requests (reviewed_by);
create index if not exists time_off_requests_thread_id_idx on public.time_off_requests (thread_id);

-- 2) Avatars: no bucket listing ----------------------------------------------
-- Object URLs on a public bucket work without a SELECT policy; only the
-- owner-scoped write policies remain.

drop policy if exists "avatars_public_read" on storage.objects;

-- 3) pg_net out of public -----------------------------------------------------
-- Guarded: older pg_net versions don't support SET SCHEMA.

do $$
begin
  alter extension pg_net set schema extensions;
exception
  when others then
    raise notice 'pg_net schema move skipped: %', sqlerrm;
end;
$$;
