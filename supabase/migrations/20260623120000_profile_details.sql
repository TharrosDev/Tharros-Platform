-- Profile details: richer personal profile (avatar, about, contact) + the
-- public `avatars` Storage bucket. Profiles RLS already allows self-update,
-- so the new columns are covered by the existing policies.

alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists bio text,
  add column if not exists job_title text,
  add column if not exists phone text,
  add column if not exists location text,
  add column if not exists timezone text;

-- Public-read avatars bucket. Paths are `<user_id>/<filename>`; the first
-- path segment gates writes to the owner (same convention as `documents`,
-- which uses org_id-first paths).
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars_owner_insert" on storage.objects;
create policy "avatars_owner_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "avatars_owner_update" on storage.objects;
create policy "avatars_owner_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "avatars_owner_delete" on storage.objects;
create policy "avatars_owner_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
