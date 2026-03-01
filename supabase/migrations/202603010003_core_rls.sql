-- Volunteer Coordination Platform - Core RLS rules

-- Ensure RLS is enabled on all app tables
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.events enable row level security;
alter table public.shifts enable row level security;
alter table public.shift_signups enable row level security;

-- Admin helper for policies
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = uid
      and ur.role = 'admin'
  );
$$;

revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to anon, authenticated, service_role;

-- ---------------------------
-- profiles
-- ---------------------------
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own_or_admin" on public.profiles;
drop policy if exists "profiles_select_authenticated" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_select_authenticated"
on public.profiles
for select
to authenticated
using (true);

create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- ---------------------------
-- user_roles
-- ---------------------------
drop policy if exists "user_roles_select_authenticated" on public.user_roles;
drop policy if exists "user_roles_admin_manage" on public.user_roles;
drop policy if exists "user_roles_select_own_or_admin" on public.user_roles;
drop policy if exists "user_roles_insert_admin_only" on public.user_roles;
drop policy if exists "user_roles_update_admin_only" on public.user_roles;
drop policy if exists "user_roles_delete_admin_only" on public.user_roles;

create policy "user_roles_select_own_or_admin"
on public.user_roles
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin(auth.uid())
);

create policy "user_roles_insert_admin_only"
on public.user_roles
for insert
to authenticated
with check (public.is_admin(auth.uid()));

create policy "user_roles_update_admin_only"
on public.user_roles
for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy "user_roles_delete_admin_only"
on public.user_roles
for delete
to authenticated
using (public.is_admin(auth.uid()));

-- ---------------------------
-- events
-- ---------------------------
drop policy if exists "events_select_published_or_owner_or_admin" on public.events;
drop policy if exists "events_insert_owner_or_admin" on public.events;
drop policy if exists "events_update_owner_or_admin" on public.events;
drop policy if exists "events_delete_owner_or_admin" on public.events;
drop policy if exists "events_select_published_public" on public.events;
drop policy if exists "events_select_own_or_admin" on public.events;
drop policy if exists "events_insert_authenticated" on public.events;

create policy "events_select_published_public"
on public.events
for select
to public
using (status = 'published');

create policy "events_select_own_or_admin"
on public.events
for select
to authenticated
using (
  created_by = auth.uid()
  or public.is_admin(auth.uid())
);

create policy "events_insert_authenticated"
on public.events
for insert
to authenticated
with check (
  created_by = auth.uid()
  or public.is_admin(auth.uid())
);

create policy "events_update_owner_or_admin"
on public.events
for update
to authenticated
using (
  created_by = auth.uid()
  or public.is_admin(auth.uid())
)
with check (
  created_by = auth.uid()
  or public.is_admin(auth.uid())
);

create policy "events_delete_owner_or_admin"
on public.events
for delete
to authenticated
using (
  created_by = auth.uid()
  or public.is_admin(auth.uid())
);

-- ---------------------------
-- shifts
-- ---------------------------
drop policy if exists "shifts_select_authenticated" on public.shifts;
drop policy if exists "shifts_manage_event_owner_or_admin" on public.shifts;
drop policy if exists "shifts_select_published_event_public" on public.shifts;
drop policy if exists "shifts_select_owner_or_admin" on public.shifts;
drop policy if exists "shifts_insert_owner_or_admin" on public.shifts;
drop policy if exists "shifts_update_owner_or_admin" on public.shifts;
drop policy if exists "shifts_delete_owner_or_admin" on public.shifts;

create policy "shifts_select_published_event_public"
on public.shifts
for select
to public
using (
  exists (
    select 1
    from public.events e
    where e.id = shifts.event_id
      and e.status = 'published'
  )
);

create policy "shifts_select_owner_or_admin"
on public.shifts
for select
to authenticated
using (
  exists (
    select 1
    from public.events e
    where e.id = shifts.event_id
      and (
        e.created_by = auth.uid()
        or public.is_admin(auth.uid())
      )
  )
);

create policy "shifts_insert_owner_or_admin"
on public.shifts
for insert
to authenticated
with check (
  exists (
    select 1
    from public.events e
    where e.id = shifts.event_id
      and (
        e.created_by = auth.uid()
        or public.is_admin(auth.uid())
      )
  )
);

create policy "shifts_update_owner_or_admin"
on public.shifts
for update
to authenticated
using (
  exists (
    select 1
    from public.events e
    where e.id = shifts.event_id
      and (
        e.created_by = auth.uid()
        or public.is_admin(auth.uid())
      )
  )
)
with check (
  exists (
    select 1
    from public.events e
    where e.id = shifts.event_id
      and (
        e.created_by = auth.uid()
        or public.is_admin(auth.uid())
      )
  )
);

create policy "shifts_delete_owner_or_admin"
on public.shifts
for delete
to authenticated
using (
  exists (
    select 1
    from public.events e
    where e.id = shifts.event_id
      and (
        e.created_by = auth.uid()
        or public.is_admin(auth.uid())
      )
  )
);

-- ---------------------------
-- shift_signups
-- ---------------------------
drop policy if exists "shift_signups_select_related_or_admin" on public.shift_signups;
drop policy if exists "shift_signups_insert_self_or_admin" on public.shift_signups;
drop policy if exists "shift_signups_update_self_owner_or_admin" on public.shift_signups;
drop policy if exists "shift_signups_delete_self_or_admin" on public.shift_signups;
drop policy if exists "shift_signups_select_own_or_event_owner_or_admin" on public.shift_signups;
drop policy if exists "shift_signups_insert_self" on public.shift_signups;
drop policy if exists "shift_signups_update_self_cancel" on public.shift_signups;
drop policy if exists "shift_signups_update_event_owner_or_admin" on public.shift_signups;
drop policy if exists "shift_signups_delete_admin_only" on public.shift_signups;

create policy "shift_signups_select_own_or_event_owner_or_admin"
on public.shift_signups
for select
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
  )
);

create policy "shift_signups_insert_self"
on public.shift_signups
for insert
to authenticated
with check (user_id = auth.uid());

create policy "shift_signups_update_self_cancel"
on public.shift_signups
for update
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and status = 'cancelled'
);

create policy "shift_signups_update_event_owner_or_admin"
on public.shift_signups
for update
to authenticated
using (
  public.is_admin(auth.uid())
  or exists (
    select 1
    from public.shifts s
    join public.events e on e.id = s.event_id
    where s.id = shift_signups.shift_id
      and e.created_by = auth.uid()
  )
)
with check (
  public.is_admin(auth.uid())
  or exists (
    select 1
    from public.shifts s
    join public.events e on e.id = s.event_id
    where s.id = shift_signups.shift_id
      and e.created_by = auth.uid()
  )
);

create policy "shift_signups_delete_admin_only"
on public.shift_signups
for delete
to authenticated
using (public.is_admin(auth.uid()));
