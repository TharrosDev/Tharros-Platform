alter table public.automations
  drop constraint if exists automations_action_type_check;

alter table public.automations
  add constraint automations_action_type_check
  check (action_type in ('notify_team', 'set_lead_status', 'draft_follow_up'));
