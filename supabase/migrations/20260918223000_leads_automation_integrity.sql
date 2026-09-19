-- Production hardening for the Lead Capture + Automations domain.
-- App validation is not a security boundary: authenticated users can call
-- PostgREST directly, so immutable tenant keys and config invariants live here.

alter table public.lead_capture_forms
  drop constraint if exists lead_capture_forms_headline_length_check,
  drop constraint if exists lead_capture_forms_success_message_length_check,
  add constraint lead_capture_forms_headline_length_check
    check (char_length(headline) between 1 and 240),
  add constraint lead_capture_forms_success_message_length_check
    check (char_length(success_message) between 1 and 500);

alter table public.leads
  drop constraint if exists leads_email_length_check,
  drop constraint if exists leads_phone_length_check,
  drop constraint if exists leads_company_length_check,
  drop constraint if exists leads_message_length_check,
  add constraint leads_email_length_check
    check (email is null or char_length(email) <= 320),
  add constraint leads_phone_length_check
    check (phone is null or char_length(phone) <= 80),
  add constraint leads_company_length_check
    check (company is null or char_length(company) <= 160),
  add constraint leads_message_length_check
    check (message is null or char_length(message) <= 4000);

alter table public.lead_events
  drop constraint if exists lead_events_data_object_check,
  add constraint lead_events_data_object_check
    check (jsonb_typeof(data) = 'object');

alter table public.automations
  drop constraint if exists automations_trigger_config_object_check,
  drop constraint if exists automations_action_config_object_check,
  drop constraint if exists automations_trigger_status_check,
  drop constraint if exists automations_action_status_check,
  drop constraint if exists automations_notify_email_check,
  add constraint automations_trigger_config_object_check
    check (jsonb_typeof(trigger_config) = 'object'),
  add constraint automations_action_config_object_check
    check (jsonb_typeof(action_config) = 'object'),
  add constraint automations_trigger_status_check
    check (
      trigger_type <> 'lead.status_changed'
      or not (trigger_config ? 'toStatus')
      or trigger_config->>'toStatus' in ('new', 'contacted', 'qualified', 'won', 'lost')
    ),
  add constraint automations_action_status_check
    check (
      action_type <> 'set_lead_status'
      or action_config->>'status' in ('new', 'contacted', 'qualified', 'won', 'lost')
    ),
  add constraint automations_notify_email_check
    check (
      action_type <> 'notify_team'
      or not (action_config ? 'email')
      or jsonb_typeof(action_config->'email') = 'boolean'
    );

alter table public.automation_runs
  drop constraint if exists automation_runs_result_object_check,
  add constraint automation_runs_result_object_check
    check (jsonb_typeof(result) = 'object');

create or replace function public.prevent_org_id_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.org_id is distinct from old.org_id then
    raise exception 'org_id is immutable' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function public.prevent_org_id_change() from public, anon, authenticated;

drop trigger if exists lead_capture_forms_org_immutable on public.lead_capture_forms;
create trigger lead_capture_forms_org_immutable
  before update on public.lead_capture_forms
  for each row execute function public.prevent_org_id_change();

drop trigger if exists leads_org_immutable on public.leads;
create trigger leads_org_immutable
  before update on public.leads
  for each row execute function public.prevent_org_id_change();

drop trigger if exists lead_events_org_immutable on public.lead_events;
create trigger lead_events_org_immutable
  before update on public.lead_events
  for each row execute function public.prevent_org_id_change();

drop trigger if exists automations_org_immutable on public.automations;
create trigger automations_org_immutable
  before update on public.automations
  for each row execute function public.prevent_org_id_change();

drop trigger if exists automation_runs_org_immutable on public.automation_runs;
create trigger automation_runs_org_immutable
  before update on public.automation_runs
  for each row execute function public.prevent_org_id_change();

create or replace function public.assert_lead_tenant_links()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.capture_form_id is not null and not exists (
    select 1
    from public.lead_capture_forms f
    where f.id = new.capture_form_id
      and f.org_id = new.org_id
  ) then
    raise exception 'capture form must belong to the lead organization'
      using errcode = 'foreign_key_violation';
  end if;
  return new;
end;
$$;

create or replace function public.assert_lead_event_tenant_links()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.leads l
    where l.id = new.lead_id and l.org_id = new.org_id
  ) then
    raise exception 'lead event must belong to the lead organization'
      using errcode = 'foreign_key_violation';
  end if;
  return new;
end;
$$;

create or replace function public.assert_automation_run_tenant_links()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.automations a
    where a.id = new.automation_id and a.org_id = new.org_id
  ) then
    raise exception 'automation run must belong to the automation organization'
      using errcode = 'foreign_key_violation';
  end if;

  if new.lead_id is not null and not exists (
    select 1 from public.leads l
    where l.id = new.lead_id and l.org_id = new.org_id
  ) then
    raise exception 'automation run lead must belong to the run organization'
      using errcode = 'foreign_key_violation';
  end if;

  if new.event_id is not null and not exists (
    select 1 from public.lead_events e
    where e.id = new.event_id and e.org_id = new.org_id
  ) then
    raise exception 'automation run event must belong to the run organization'
      using errcode = 'foreign_key_violation';
  end if;

  return new;
end;
$$;

revoke execute on function public.assert_lead_tenant_links() from public, anon, authenticated;
revoke execute on function public.assert_lead_event_tenant_links() from public, anon, authenticated;
revoke execute on function public.assert_automation_run_tenant_links() from public, anon, authenticated;

drop trigger if exists leads_tenant_links on public.leads;
create trigger leads_tenant_links
  before insert or update of capture_form_id, org_id on public.leads
  for each row execute function public.assert_lead_tenant_links();

drop trigger if exists lead_events_tenant_links on public.lead_events;
create trigger lead_events_tenant_links
  before insert or update of lead_id, org_id on public.lead_events
  for each row execute function public.assert_lead_event_tenant_links();

drop trigger if exists automation_runs_tenant_links on public.automation_runs;
create trigger automation_runs_tenant_links
  before insert or update of automation_id, event_id, lead_id, org_id on public.automation_runs
  for each row execute function public.assert_automation_run_tenant_links();
