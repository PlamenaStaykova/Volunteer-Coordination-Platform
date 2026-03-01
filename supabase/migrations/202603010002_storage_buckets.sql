-- Volunteer Coordination Platform - Storage buckets and policies

-- Buckets
insert into storage.buckets (id, name, public)
values ('event-covers', 'event-covers', true)
on conflict (id) do update
set public = excluded.public;

insert into storage.buckets (id, name, public)
values ('attendance-proofs', 'attendance-proofs', false)
on conflict (id) do update
set public = excluded.public;

-- event-covers: public read, authenticated upload/manage own objects
drop policy if exists "event_covers_public_read" on storage.objects;
create policy "event_covers_public_read"
on storage.objects
for select
to public
using (bucket_id = 'event-covers');

drop policy if exists "event_covers_auth_insert" on storage.objects;
create policy "event_covers_auth_insert"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'event-covers');

drop policy if exists "event_covers_owner_update" on storage.objects;
create policy "event_covers_owner_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'event-covers'
  and (
    owner = auth.uid()
    or public.is_admin(auth.uid())
  )
)
with check (
  bucket_id = 'event-covers'
  and (
    owner = auth.uid()
    or public.is_admin(auth.uid())
  )
);

drop policy if exists "event_covers_owner_delete" on storage.objects;
create policy "event_covers_owner_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'event-covers'
  and (
    owner = auth.uid()
    or public.is_admin(auth.uid())
  )
);

-- attendance-proofs: private, only owner folder (first path segment = auth.uid())
drop policy if exists "attendance_proofs_select_own" on storage.objects;
create policy "attendance_proofs_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'attendance-proofs'
  and (
    coalesce((storage.foldername(name))[1], '') = auth.uid()::text
    or public.is_admin(auth.uid())
  )
);

drop policy if exists "attendance_proofs_insert_own" on storage.objects;
create policy "attendance_proofs_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'attendance-proofs'
  and (
    coalesce((storage.foldername(name))[1], '') = auth.uid()::text
    or public.is_admin(auth.uid())
  )
);

drop policy if exists "attendance_proofs_update_own" on storage.objects;
create policy "attendance_proofs_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'attendance-proofs'
  and (
    coalesce((storage.foldername(name))[1], '') = auth.uid()::text
    or public.is_admin(auth.uid())
  )
)
with check (
  bucket_id = 'attendance-proofs'
  and (
    coalesce((storage.foldername(name))[1], '') = auth.uid()::text
    or public.is_admin(auth.uid())
  )
);

drop policy if exists "attendance_proofs_delete_own" on storage.objects;
create policy "attendance_proofs_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'attendance-proofs'
  and (
    coalesce((storage.foldername(name))[1], '') = auth.uid()::text
    or public.is_admin(auth.uid())
  )
);
