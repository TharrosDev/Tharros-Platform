-- Mega security hardening (2026-09-19)
--
-- Defense-in-depth for bearer credentials, tenant immutability, provider-managed
-- fields, storage uploads, chat integrity, and scheduling cross-tenant links.
-- This migration intentionally assumes all prior repo migrations are applied.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- 1) One-way hashing for bearer credentials
-- ---------------------------------------------------------------------------

create or replace function public.hash_bearer_token(p_token text)
returns text
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to(p_token, 'UTF8'), 'sha256'),
    'hex'
  );
$$;

revoke execute on function public.hash_bearer_token(text)
  from public, anon, authenticated;

-- Team invites: preserve live links by hashing existing raw tokens before the
-- plaintext column is removed. RPCs still return the raw token exactly once.
alter table public.invites add column if not exists token_hash text;

update public.invites
set token_hash = public.hash_bearer_token(token)
where token_hash is null and token is not null;

alter table public.invites
  alter column token_hash set not null;

create unique index if not exists invites_token_hash_uidx
  on public.invites (token_hash);

create or replace function public.create_invite(
  p_org   uuid,
  p_email text,
  p_role  text default 'member'
)
returns table (id uuid, token text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := (select auth.uid());
  v_email    text := lower(btrim(p_email));
  v_token    text := public.new_invite_token();
  v_hash     text := public.hash_bearer_token(v_token);
  v_existing uuid;
  v_id       uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;
  if coalesce(public.current_user_role(p_org), '') not in ('owner', 'admin') then
    raise exception 'Only an owner or admin can invite people'
      using errcode = 'insufficient_privilege';
  end if;
  if p_role not in ('admin', 'member') then
    raise exception 'Role must be admin or member' using errcode = 'check_violation';
  end if;
  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'A valid email is required' using errcode = 'check_violation';
  end if;

  if exists (
    select 1
    from public.memberships m
    join public.profiles p on p.id = m.user_id
    where m.org_id = p_org and lower(p.email) = v_email
  ) then
    raise exception 'That person is already a member of this organization'
      using errcode = 'unique_violation';
  end if;

  select i.id into v_existing
  from public.invites i
  where i.org_id = p_org
    and lower(i.email) = v_email
    and i.accepted_at is null
    and i.revoked_at is null;

  if v_existing is not null then
    update public.invites
    set token_hash = v_hash,
        role = p_role,
        invited_by = v_uid,
        created_at = now(),
        expires_at = now() + interval '7 days'
    where invites.id = v_existing;
    return query select v_existing, v_token;
  else
    insert into public.invites (org_id, email, role, token_hash, invited_by)
    values (p_org, v_email, p_role, v_hash, v_uid)
    returning invites.id into v_id;
    return query select v_id, v_token;
  end if;
end;
$$;

create or replace function public.resend_invite(p_invite uuid)
returns table (id uuid, token text, email text, role text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org   uuid;
  v_token text := public.new_invite_token();
  v_id    uuid;
  v_email text;
  v_role  text;
begin
  select i.org_id into v_org from public.invites i where i.id = p_invite;
  if v_org is null then
    raise exception 'Invite not found' using errcode = 'no_data_found';
  end if;
  if coalesce(public.current_user_role(v_org), '') not in ('owner', 'admin') then
    raise exception 'Only an owner or admin can resend invites'
      using errcode = 'insufficient_privilege';
  end if;

  update public.invites
  set token_hash = public.hash_bearer_token(v_token),
      expires_at = now() + interval '7 days'
  where invites.id = p_invite
    and invites.accepted_at is null
    and invites.revoked_at is null
  returning invites.id, invites.email, invites.role into v_id, v_email, v_role;

  if not found then
    raise exception 'Invite is no longer pending' using errcode = 'check_violation';
  end if;

  return query select v_id, v_token, v_email, v_role;
end;
$$;

create or replace function public.accept_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_email  text := lower((select auth.email()));
  v_invite public.invites%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;
  if coalesce(p_token, '') = '' then
    raise exception 'This invite link is invalid' using errcode = 'no_data_found';
  end if;

  select * into v_invite
  from public.invites
  where token_hash = public.hash_bearer_token(p_token);

  if v_invite.id is null then
    raise exception 'This invite link is invalid' using errcode = 'no_data_found';
  end if;
  if v_invite.revoked_at is not null then
    raise exception 'This invite has been revoked' using errcode = 'check_violation';
  end if;
  if v_invite.accepted_at is not null then
    raise exception 'This invite has already been used' using errcode = 'check_violation';
  end if;
  if v_invite.expires_at <= now() then
    raise exception 'This invite has expired' using errcode = 'check_violation';
  end if;
  if lower(v_invite.email) <> v_email then
    raise exception 'This invite was sent to a different email address'
      using errcode = 'check_violation';
  end if;

  insert into public.memberships (user_id, org_id, role)
  values (v_uid, v_invite.org_id, v_invite.role)
  on conflict (user_id, org_id) do nothing;

  update public.invites set accepted_at = now() where id = v_invite.id;
  update public.profiles set current_org_id = v_invite.org_id where id = v_uid;

  return v_invite.org_id;
end;
$$;

drop index if exists public.invites_token_idx;
alter table public.invites drop constraint if exists invites_token_key;
alter table public.invites drop column if exists token;

revoke select on table public.invites from anon, authenticated;
grant select (
  id, org_id, email, role, invited_by, created_at, expires_at, accepted_at, revoked_at
) on table public.invites to authenticated;

-- Employee portal: the raw magic-link credential is never readable from the DB.
alter table public.employee_portal_tokens add column if not exists token_hash text;

update public.employee_portal_tokens
set token_hash = public.hash_bearer_token(token)
where token_hash is null and token is not null;

update public.employee_portal_tokens
set expires_at = least(
  coalesce(expires_at, now() + interval '60 days'),
  now() + interval '60 days'
)
where revoked_at is null;

alter table public.employee_portal_tokens
  alter column token_hash set not null;

create unique index if not exists employee_portal_tokens_token_hash_uidx
  on public.employee_portal_tokens (token_hash);

create or replace function public.issue_portal_token(p_employee_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org   uuid;
  v_token text := public.new_portal_token();
begin
  select e.org_id into v_org from public.employees e where e.id = p_employee_id;
  if v_org is null then
    raise exception 'Employee not found' using errcode = 'no_data_found';
  end if;
  if coalesce(public.current_user_role(v_org), '') not in ('owner', 'admin') then
    raise exception 'Only an owner or admin can issue a portal link'
      using errcode = 'insufficient_privilege';
  end if;

  update public.employee_portal_tokens
  set revoked_at = now()
  where employee_id = p_employee_id and revoked_at is null;

  insert into public.employee_portal_tokens (
    employee_id, org_id, token_hash, expires_at
  )
  values (
    p_employee_id,
    v_org,
    public.hash_bearer_token(v_token),
    now() + interval '60 days'
  );

  return v_token;
end;
$$;

create or replace function public.validate_portal_token(p_token text)
returns table (
  employee_id   uuid,
  org_id        uuid,
  employee_name text,
  org_name      text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_employee uuid;
  v_hash text;
begin
  if coalesce(p_token, '') = '' then
    return;
  end if;

  v_hash := public.hash_bearer_token(p_token);

  select t.employee_id into v_employee
  from public.employee_portal_tokens t
  join public.employees e on e.id = t.employee_id
  where t.token_hash = v_hash
    and t.revoked_at is null
    and t.expires_at > now()
    and e.active;

  if v_employee is null then
    return;
  end if;

  update public.employee_portal_tokens
  set last_used_at = now()
  where token_hash = v_hash;

  return query
  select e.id, e.org_id, e.name, o.name
  from public.employees e
  join public.organizations o on o.id = e.org_id
  where e.id = v_employee;
end;
$$;

drop index if exists public.employee_portal_tokens_token_idx;
alter table public.employee_portal_tokens
  drop constraint if exists employee_portal_tokens_token_key;
alter table public.employee_portal_tokens drop column if exists token;

revoke select on table public.employee_portal_tokens from anon, authenticated;
grant select (
  id, employee_id, org_id, created_at, expires_at, revoked_at, last_used_at
) on table public.employee_portal_tokens to authenticated;

revoke execute on function public.validate_portal_token(text) from authenticated, public;
grant execute on function public.validate_portal_token(text) to anon;

-- ---------------------------------------------------------------------------
-- 2) Immutable tenant keys everywhere
-- ---------------------------------------------------------------------------

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

revoke execute on function public.prevent_org_id_change()
  from public, anon, authenticated;

do $$
declare
  t record;
begin
  for t in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables it
      on it.table_schema = c.table_schema
     and it.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'org_id'
      and it.table_type = 'BASE TABLE'
  loop
    execute format(
      'drop trigger if exists enforce_immutable_org_id on public.%I',
      t.table_name
    );
    execute format(
      'create trigger enforce_immutable_org_id before update of org_id on public.%I
       for each row execute function public.prevent_org_id_change()',
      t.table_name
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3) Column-level privileges for provider/system-managed fields
-- ---------------------------------------------------------------------------

revoke update on table public.organizations from authenticated;
grant update (name, industry, size)
  on table public.organizations to authenticated;

revoke update on table public.profiles from authenticated;
grant update (
  full_name, current_org_id, avatar_url, bio, job_title, phone, location, timezone
) on table public.profiles to authenticated;

revoke update on table public.memberships from authenticated;
grant update (role) on table public.memberships to authenticated;

revoke update on table public.org_settings from authenticated;
grant update (timezone, locale, notifications)
  on table public.org_settings to authenticated;

-- Documents are reserved by the authenticated server action through the service
-- role. Browser clients only upload bytes to the pre-reserved Storage path and
-- may edit tags/delete their org-visible rows.
revoke insert, update on table public.documents from authenticated;
grant update (tags) on table public.documents to authenticated;

-- Conversation identity is immutable to clients; only title/sort timestamp may
-- change. User messages are allowed, assistant/provider metadata is not.
revoke insert, update on table public.conversations from authenticated;
grant insert (org_id, user_id, title) on table public.conversations to authenticated;
grant update (title, updated_at) on table public.conversations to authenticated;

revoke insert on table public.messages from authenticated;
grant insert (conversation_id, org_id, role, content)
  on table public.messages to authenticated;

drop policy if exists messages_insert on public.messages;
create policy messages_insert
  on public.messages
  for insert
  to authenticated
  with check (
    role = 'user'
    and citations = '[]'::jsonb
    and usage is null
    and char_length(content) between 1 and 2000
    and exists (
      select 1
      from public.conversations c
      where c.id = conversation_id
        and c.org_id = messages.org_id
        and c.user_id = (select auth.uid())
    )
  );

create or replace function public.prevent_conversation_identity_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.org_id is distinct from old.org_id
     or new.user_id is distinct from old.user_id then
    raise exception 'conversation identity is immutable'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function public.prevent_conversation_identity_change()
  from public, anon, authenticated;

drop trigger if exists conversations_identity_immutable on public.conversations;
create trigger conversations_identity_immutable
  before update of org_id, user_id on public.conversations
  for each row execute function public.prevent_conversation_identity_change();

create or replace function public.assert_message_tenant_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.conversations c
    where c.id = new.conversation_id
      and c.org_id = new.org_id
  ) then
    raise exception 'message conversation must belong to the same organization'
      using errcode = 'foreign_key_violation';
  end if;
  return new;
end;
$$;

revoke execute on function public.assert_message_tenant_link()
  from public, anon, authenticated;

drop trigger if exists messages_tenant_link on public.messages;
create trigger messages_tenant_link
  before insert or update of conversation_id, org_id on public.messages
  for each row execute function public.assert_message_tenant_link();

-- ---------------------------------------------------------------------------
-- 4) Scheduling cross-table tenant integrity
-- ---------------------------------------------------------------------------

create or replace function public.assert_scheduling_tenant_links()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'employee_role_assignments' then
    if not exists (
      select 1 from public.employees e
      where e.id = new.employee_id and e.org_id = new.org_id
    ) or not exists (
      select 1 from public.roles_certifications r
      where r.id = new.role_certification_id and r.org_id = new.org_id
    ) then
      raise exception 'scheduling relationship crosses organization boundary'
        using errcode = 'foreign_key_violation';
    end if;

  elsif tg_table_name = 'availability' then
    if not exists (
      select 1 from public.employees e
      where e.id = new.employee_id and e.org_id = new.org_id
    ) then
      raise exception 'availability employee must belong to the same organization'
        using errcode = 'foreign_key_violation';
    end if;

  elsif tg_table_name = 'staffing_requirements' then
    if new.role_certification_id is not null and not exists (
      select 1 from public.roles_certifications r
      where r.id = new.role_certification_id and r.org_id = new.org_id
    ) then
      raise exception 'staffing role must belong to the same organization'
        using errcode = 'foreign_key_violation';
    end if;

  elsif tg_table_name = 'shifts' then
    if not exists (
      select 1 from public.schedules s
      where s.id = new.schedule_id and s.org_id = new.org_id
    ) then
      raise exception 'shift schedule must belong to the same organization'
        using errcode = 'foreign_key_violation';
    end if;
    if new.employee_id is not null and not exists (
      select 1 from public.employees e
      where e.id = new.employee_id and e.org_id = new.org_id
    ) then
      raise exception 'shift employee must belong to the same organization'
        using errcode = 'foreign_key_violation';
    end if;
    if new.role_certification_id is not null and not exists (
      select 1 from public.roles_certifications r
      where r.id = new.role_certification_id and r.org_id = new.org_id
    ) then
      raise exception 'shift role must belong to the same organization'
        using errcode = 'foreign_key_violation';
    end if;

  elsif tg_table_name = 'time_off_requests' then
    if not exists (
      select 1 from public.employees e
      where e.id = new.employee_id and e.org_id = new.org_id
    ) then
      raise exception 'time-off employee must belong to the same organization'
        using errcode = 'foreign_key_violation';
    end if;

  elsif tg_table_name = 'sick_call_events' then
    if not exists (
      select 1 from public.employees e
      where e.id = new.employee_id and e.org_id = new.org_id
    ) then
      raise exception 'sick-call employee must belong to the same organization'
        using errcode = 'foreign_key_violation';
    end if;
    if new.shift_id is not null and not exists (
      select 1 from public.shifts s
      where s.id = new.shift_id and s.org_id = new.org_id
    ) then
      raise exception 'sick-call shift must belong to the same organization'
        using errcode = 'foreign_key_violation';
    end if;

  elsif tg_table_name = 'shift_swap_requests' then
    if not exists (
      select 1 from public.shifts s
      where s.id = new.shift_id and s.org_id = new.org_id
    ) or not exists (
      select 1 from public.employees e
      where e.id = new.requesting_employee_id and e.org_id = new.org_id
    ) then
      raise exception 'swap source must belong to the same organization'
        using errcode = 'foreign_key_violation';
    end if;
    if new.target_employee_id is not null and not exists (
      select 1 from public.employees e
      where e.id = new.target_employee_id and e.org_id = new.org_id
    ) then
      raise exception 'swap target employee must belong to the same organization'
        using errcode = 'foreign_key_violation';
    end if;
    if new.target_shift_id is not null and not exists (
      select 1 from public.shifts s
      where s.id = new.target_shift_id and s.org_id = new.org_id
    ) then
      raise exception 'swap target shift must belong to the same organization'
        using errcode = 'foreign_key_violation';
    end if;

  elsif tg_table_name = 'replacement_pool_events' then
    if not exists (
      select 1 from public.shifts s
      where s.id = new.shift_id and s.org_id = new.org_id
    ) or not exists (
      select 1 from public.employees e
      where e.id = new.employee_id and e.org_id = new.org_id
    ) then
      raise exception 'replacement relationship crosses organization boundary'
        using errcode = 'foreign_key_violation';
    end if;
    if new.sick_call_id is not null and not exists (
      select 1 from public.sick_call_events sc
      where sc.id = new.sick_call_id and sc.org_id = new.org_id
    ) then
      raise exception 'replacement sick call must belong to the same organization'
        using errcode = 'foreign_key_violation';
    end if;

  elsif tg_table_name = 'schedule_versions' then
    if not exists (
      select 1 from public.schedules s
      where s.id = new.schedule_id and s.org_id = new.org_id
    ) then
      raise exception 'schedule version must belong to the same organization'
        using errcode = 'foreign_key_violation';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.assert_scheduling_tenant_links()
  from public, anon, authenticated;

drop trigger if exists employee_role_assignments_tenant_links on public.employee_role_assignments;
create trigger employee_role_assignments_tenant_links
  before insert or update of org_id, employee_id, role_certification_id
  on public.employee_role_assignments
  for each row execute function public.assert_scheduling_tenant_links();

drop trigger if exists availability_tenant_links on public.availability;
create trigger availability_tenant_links
  before insert or update of org_id, employee_id on public.availability
  for each row execute function public.assert_scheduling_tenant_links();

drop trigger if exists staffing_requirements_tenant_links on public.staffing_requirements;
create trigger staffing_requirements_tenant_links
  before insert or update of org_id, role_certification_id on public.staffing_requirements
  for each row execute function public.assert_scheduling_tenant_links();

drop trigger if exists shifts_tenant_links on public.shifts;
create trigger shifts_tenant_links
  before insert or update of org_id, schedule_id, employee_id, role_certification_id on public.shifts
  for each row execute function public.assert_scheduling_tenant_links();

drop trigger if exists time_off_requests_tenant_links on public.time_off_requests;
create trigger time_off_requests_tenant_links
  before insert or update of org_id, employee_id on public.time_off_requests
  for each row execute function public.assert_scheduling_tenant_links();

drop trigger if exists sick_call_events_tenant_links on public.sick_call_events;
create trigger sick_call_events_tenant_links
  before insert or update of org_id, employee_id, shift_id on public.sick_call_events
  for each row execute function public.assert_scheduling_tenant_links();

drop trigger if exists shift_swap_requests_tenant_links on public.shift_swap_requests;
create trigger shift_swap_requests_tenant_links
  before insert or update of org_id, shift_id, requesting_employee_id, target_employee_id, target_shift_id
  on public.shift_swap_requests
  for each row execute function public.assert_scheduling_tenant_links();

drop trigger if exists replacement_pool_events_tenant_links on public.replacement_pool_events;
create trigger replacement_pool_events_tenant_links
  before insert or update of org_id, shift_id, sick_call_id, employee_id
  on public.replacement_pool_events
  for each row execute function public.assert_scheduling_tenant_links();

drop trigger if exists schedule_versions_tenant_links on public.schedule_versions;
create trigger schedule_versions_tenant_links
  before insert or update of org_id, schedule_id on public.schedule_versions
  for each row execute function public.assert_scheduling_tenant_links();

-- ---------------------------------------------------------------------------
-- 5) Storage is bound to server-reserved document rows + bucket limits
-- ---------------------------------------------------------------------------

update storage.buckets
set file_size_limit = 26214400,
    allowed_mime_types = array[
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/markdown'
    ]::text[]
where id = 'documents';

update storage.buckets
set file_size_limit = 2097152,
    allowed_mime_types = array[
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif'
    ]::text[]
where id = 'avatars';

-- Avatar writes are one fixed object per user, so a signed-in account cannot
-- turn the public avatar bucket into unmetered general-purpose object storage.
drop policy if exists "avatars_owner_insert" on storage.objects;
create policy "avatars_owner_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and name = (select auth.uid())::text || '/avatar'
  );

drop policy if exists "avatars_owner_update" on storage.objects;
create policy "avatars_owner_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and name = (select auth.uid())::text || '/avatar'
  )
  with check (
    bucket_id = 'avatars'
    and name = (select auth.uid())::text || '/avatar'
  );

drop policy if exists documents_objects_insert_member on storage.objects;
create policy documents_objects_insert_member
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'documents'
    and exists (
      select 1
      from public.documents d
      where d.org_id::text = (storage.foldername(name))[1]
        and d.id::text = (storage.foldername(name))[2]
        and d.storage_path = name
        and d.uploaded_by = (select auth.uid())
        and public.current_user_role(d.org_id) is not null
    )
  );

drop policy if exists documents_objects_update_member on storage.objects;
create policy documents_objects_update_member
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'documents'
    and exists (
      select 1
      from public.documents d
      where d.storage_path = name
        and d.uploaded_by = (select auth.uid())
        and public.current_user_role(d.org_id) is not null
    )
  )
  with check (
    bucket_id = 'documents'
    and exists (
      select 1
      from public.documents d
      where d.org_id::text = (storage.foldername(name))[1]
        and d.id::text = (storage.foldername(name))[2]
        and d.storage_path = name
        and d.uploaded_by = (select auth.uid())
        and public.current_user_role(d.org_id) is not null
    )
  );

-- ---------------------------------------------------------------------------
-- 6) Safer defaults for future database functions
-- ---------------------------------------------------------------------------

alter default privileges in schema public
  revoke execute on functions from public, anon, authenticated;
