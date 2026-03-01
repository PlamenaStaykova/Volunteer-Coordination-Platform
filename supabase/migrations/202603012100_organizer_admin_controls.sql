-- Organizer acts as admin for campaign management.
-- Enforces server-side permissions and adds "done" campaign status.

create or replace function public.is_organizer(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = uid
      and p.user_type = 'organizer'
  );
$$;

revoke all on function public.is_organizer(uuid) from public;
grant execute on function public.is_organizer(uuid) to anon, authenticated, service_role;

alter table public.events
drop constraint if exists events_status_check;

alter table public.events
add constraint events_status_check
check (status in ('draft', 'published', 'done', 'cancelled'));

-- events policies
drop policy if exists "events_select_published_public" on public.events;
drop policy if exists "events_select_own_or_admin" on public.events;
drop policy if exists "events_insert_authenticated" on public.events;
drop policy if exists "events_update_owner_or_admin" on public.events;
drop policy if exists "events_delete_owner_or_admin" on public.events;

create policy "events_select_published_public"
on public.events
for select
to public
using (status in ('published', 'done'));

create policy "events_select_own_or_admin"
on public.events
for select
to authenticated
using (
  status in ('published', 'done')
  or created_by = auth.uid()
  or public.is_admin(auth.uid())
);

create policy "events_insert_organizer_or_admin"
on public.events
for insert
to authenticated
with check (
  created_by = auth.uid()
  and (
    public.is_organizer(auth.uid())
    or public.is_admin(auth.uid())
  )
);

create policy "events_update_organizer_owner_or_admin"
on public.events
for update
to authenticated
using (
  (
    created_by = auth.uid()
    and public.is_organizer(auth.uid())
  )
  or public.is_admin(auth.uid())
)
with check (
  (
    created_by = auth.uid()
    and public.is_organizer(auth.uid())
  )
  or public.is_admin(auth.uid())
);

create policy "events_delete_organizer_owner_or_admin"
on public.events
for delete
to authenticated
using (
  (
    created_by = auth.uid()
    and public.is_organizer(auth.uid())
  )
  or public.is_admin(auth.uid())
);

-- shifts visibility now includes done campaigns as well
drop policy if exists "shifts_select_published_event_public" on public.shifts;

create policy "shifts_select_published_event_public"
on public.shifts
for select
to public
using (
  exists (
    select 1
    from public.events e
    where e.id = shifts.event_id
      and e.status in ('published', 'done')
  )
);

-- shift_signups policies
drop policy if exists "shift_signups_insert_self" on public.shift_signups;
drop policy if exists "shift_signups_update_self_cancel" on public.shift_signups;
drop policy if exists "shift_signups_update_event_owner_or_admin" on public.shift_signups;
drop policy if exists "shift_signups_delete_admin_only" on public.shift_signups;

create policy "shift_signups_insert_self_or_owner_or_admin"
on public.shift_signups
for insert
to authenticated
with check (
  user_id = auth.uid()
  or public.is_admin(auth.uid())
  or exists (
    select 1
    from public.shifts s
    join public.events e on e.id = s.event_id
    where s.id = shift_signups.shift_id
      and e.created_by = auth.uid()
      and (
        public.is_organizer(auth.uid())
        or public.is_admin(auth.uid())
      )
  )
);

create policy "shift_signups_update_self_or_owner_or_admin"
on public.shift_signups
for update
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin(auth.uid())
  or exists (
    select 1
    from public.shifts s
    join public.events e on e.id = s.event_id
    where s.id = shift_signups.shift_id
      and e.created_by = auth.uid()
      and (
        public.is_organizer(auth.uid())
        or public.is_admin(auth.uid())
      )
  )
)
with check (
  user_id = auth.uid()
  or public.is_admin(auth.uid())
  or exists (
    select 1
    from public.shifts s
    join public.events e on e.id = s.event_id
    where s.id = shift_signups.shift_id
      and e.created_by = auth.uid()
      and (
        public.is_organizer(auth.uid())
        or public.is_admin(auth.uid())
      )
  )
);

create policy "shift_signups_delete_self_or_owner_or_admin"
on public.shift_signups
for delete
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin(auth.uid())
  or exists (
    select 1
    from public.shifts s
    join public.events e on e.id = s.event_id
    where s.id = shift_signups.shift_id
      and e.created_by = auth.uid()
      and (
        public.is_organizer(auth.uid())
        or public.is_admin(auth.uid())
      )
  )
);
