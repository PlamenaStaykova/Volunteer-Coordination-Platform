-- Volunteer Coordination Platform - Initial schema
-- Requires: pgcrypto extension for gen_random_uuid()

create extension if not exists pgcrypto;

-- 1) profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- 2) user_roles
create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin')),
  primary key (user_id, role)
);

-- 3) events
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  location text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  cover_image_path text,
  created_by uuid not null references auth.users(id),
  status text not null default 'published' check (status in ('draft', 'published', 'cancelled')),
  created_at timestamptz not null default now(),
  constraint events_time_window check (end_at > start_at)
);

create index if not exists idx_events_created_by on public.events(created_by);
create index if not exists idx_events_start_at on public.events(start_at);

-- 4) shifts
create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity int not null check (capacity > 0),
  created_at timestamptz not null default now(),
  constraint shifts_time_window check (ends_at > starts_at)
);

create index if not exists idx_shifts_event_id on public.shifts(event_id);
create index if not exists idx_shifts_starts_at on public.shifts(starts_at);

-- 5) shift_signups
create table if not exists public.shift_signups (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'signed' check (status in ('signed', 'attended', 'cancelled')),
  proof_path text,
  created_at timestamptz not null default now(),
  constraint uq_shift_signups_shift_user unique (shift_id, user_id)
);

create index if not exists idx_shift_signups_user_id on public.shift_signups(user_id);
create index if not exists idx_shift_signups_shift_id on public.shift_signups(shift_id);

-- Optional but practical: ensure every authenticated user can maintain own profile
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.events enable row level security;
alter table public.shifts enable row level security;
alter table public.shift_signups enable row level security;

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = uid
      and ur.role = 'admin'
  );
$$;

-- profiles policies
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
on public.profiles
for select
to authenticated
using (id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin"
on public.profiles
for update
to authenticated
using (id = auth.uid() or public.is_admin(auth.uid()))
with check (id = auth.uid() or public.is_admin(auth.uid()));

-- user_roles policies (admin-managed)
drop policy if exists "user_roles_select_authenticated" on public.user_roles;
create policy "user_roles_select_authenticated"
on public.user_roles
for select
to authenticated
using (true);

drop policy if exists "user_roles_admin_manage" on public.user_roles;
create policy "user_roles_admin_manage"
on public.user_roles
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

-- events policies
drop policy if exists "events_select_published_or_owner_or_admin" on public.events;
create policy "events_select_published_or_owner_or_admin"
on public.events
for select
to authenticated
using (
  status = 'published'
  or created_by = auth.uid()
  or public.is_admin(auth.uid())
);

drop policy if exists "events_insert_owner_or_admin" on public.events;
create policy "events_insert_owner_or_admin"
on public.events
for insert
to authenticated
with check (
  created_by = auth.uid()
  or public.is_admin(auth.uid())
);

drop policy if exists "events_update_owner_or_admin" on public.events;
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

drop policy if exists "events_delete_owner_or_admin" on public.events;
create policy "events_delete_owner_or_admin"
on public.events
for delete
to authenticated
using (
  created_by = auth.uid()
  or public.is_admin(auth.uid())
);

-- shifts policies (event owner or admin manage, authenticated can read)
drop policy if exists "shifts_select_authenticated" on public.shifts;
create policy "shifts_select_authenticated"
on public.shifts
for select
to authenticated
using (true);

drop policy if exists "shifts_manage_event_owner_or_admin" on public.shifts;
create policy "shifts_manage_event_owner_or_admin"
on public.shifts
for all
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

-- shift_signups policies
drop policy if exists "shift_signups_select_related_or_admin" on public.shift_signups;
create policy "shift_signups_select_related_or_admin"
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

drop policy if exists "shift_signups_insert_self_or_admin" on public.shift_signups;
create policy "shift_signups_insert_self_or_admin"
on public.shift_signups
for insert
to authenticated
with check (
  user_id = auth.uid()
  or public.is_admin(auth.uid())
);

drop policy if exists "shift_signups_update_self_owner_or_admin" on public.shift_signups;
create policy "shift_signups_update_self_owner_or_admin"
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
  )
);

drop policy if exists "shift_signups_delete_self_or_admin" on public.shift_signups;
create policy "shift_signups_delete_self_or_admin"
on public.shift_signups
for delete
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin(auth.uid())
);
