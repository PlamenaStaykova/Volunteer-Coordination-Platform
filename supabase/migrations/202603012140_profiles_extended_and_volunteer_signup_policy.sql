-- Extend profiles with dedicated contact/org fields and enforce volunteer-only self-signups.

alter table public.profiles
add column if not exists first_name text,
add column if not exists last_name text,
add column if not exists email text,
add column if not exists organization_name text,
add column if not exists campaign_manager text;

update public.profiles p
set email = au.email
from auth.users au
where au.id = p.id
  and (p.email is null or btrim(p.email) = '');

update public.profiles
set first_name = split_part(display_name, ' ', 1)
where (first_name is null or btrim(first_name) = '')
  and coalesce(display_name, '') <> '';

update public.profiles
set last_name = nullif(
  btrim(regexp_replace(display_name, '^\S+\s*', '')),
  ''
)
where (last_name is null or btrim(last_name) = '')
  and coalesce(display_name, '') <> '';

update public.profiles
set organization_name = coalesce(nullif(organization_name, ''), display_name)
where user_type = 'organizer'
  and coalesce(display_name, '') <> '';

update public.profiles
set campaign_manager = coalesce(
  nullif(campaign_manager, ''),
  nullif(trim(concat_ws(' ', first_name, last_name)), ''),
  display_name
)
where user_type = 'organizer'
  and coalesce(display_name, '') <> '';

create or replace function public.sync_profile_from_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  resolved_role text;
  resolved_display_name text;
  resolved_email text;
begin
  resolved_role := lower(coalesce(new.raw_user_meta_data ->> 'user_type', 'volunteer'));
  if resolved_role not in ('organizer', 'volunteer') then
    resolved_role := 'volunteer';
  end if;

  resolved_display_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    split_part(coalesce(new.email, ''), '@', 1),
    'User'
  );
  resolved_email := coalesce(new.email, '');

  insert into public.profiles (id, display_name, user_type, email)
  values (new.id, resolved_display_name, resolved_role::public.user_type_enum, resolved_email)
  on conflict (id) do update
  set
    user_type = excluded.user_type,
    email = coalesce(nullif(public.profiles.email, ''), excluded.email),
    display_name = coalesce(nullif(public.profiles.display_name, ''), excluded.display_name);

  return new;
end;
$$;

create or replace function public.is_volunteer(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    exists (
      select 1
      from public.profiles p
      where p.id = uid
        and p.user_type = 'volunteer'
    )
    or exists (
      select 1
      from auth.users au
      where au.id = uid
        and lower(coalesce(au.raw_user_meta_data ->> 'user_type', '')) = 'volunteer'
    );
$$;

revoke all on function public.is_volunteer(uuid) from public;
grant execute on function public.is_volunteer(uuid) to anon, authenticated, service_role;

drop policy if exists "shift_signups_insert_self_or_owner_or_admin" on public.shift_signups;
drop policy if exists "shift_signups_update_self_or_owner_or_admin" on public.shift_signups;
drop policy if exists "shift_signups_delete_self_or_owner_or_admin" on public.shift_signups;

create policy "shift_signups_insert_self_or_owner_or_admin"
on public.shift_signups
for insert
to authenticated
with check (
  (
    user_id = auth.uid()
    and public.is_volunteer(auth.uid())
  )
  or public.is_admin(auth.uid())
  or (
    user_id <> auth.uid()
    and exists (
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
);

create policy "shift_signups_update_self_or_owner_or_admin"
on public.shift_signups
for update
to authenticated
using (
  (
    user_id = auth.uid()
    and public.is_volunteer(auth.uid())
  )
  or public.is_admin(auth.uid())
  or (
    user_id <> auth.uid()
    and exists (
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
)
with check (
  (
    user_id = auth.uid()
    and public.is_volunteer(auth.uid())
  )
  or public.is_admin(auth.uid())
  or (
    user_id <> auth.uid()
    and exists (
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
);

create policy "shift_signups_delete_self_or_owner_or_admin"
on public.shift_signups
for delete
to authenticated
using (
  (
    user_id = auth.uid()
    and public.is_volunteer(auth.uid())
  )
  or public.is_admin(auth.uid())
  or (
    user_id <> auth.uid()
    and exists (
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
);

create or replace function public.get_campaign_dashboard()
returns table (
  id uuid,
  title text,
  description text,
  location text,
  start_at timestamptz,
  end_at timestamptz,
  organization text,
  max_volunteers int,
  vacancies int,
  state text
)
language sql
stable
security definer
set search_path = public
as $$
  with visible_events as (
    select
      e.id,
      e.title,
      e.description,
      e.location,
      e.start_at,
      e.end_at,
      e.created_by,
      e.status
    from public.events e
    where e.status in ('published', 'done')
  ),
  capacity_by_event as (
    select
      s.event_id,
      coalesce(sum(s.capacity), 0)::int as max_volunteers
    from public.shifts s
    join visible_events ve on ve.id = s.event_id
    group by s.event_id
  ),
  occupancy_by_event as (
    select
      s.event_id,
      count(ss.id) filter (where ss.status in ('signed', 'attended'))::int as occupied_slots
    from public.shifts s
    join visible_events ve on ve.id = s.event_id
    left join public.shift_signups ss on ss.shift_id = s.id
    group by s.event_id
  )
  select
    ve.id,
    ve.title,
    ve.description,
    ve.location,
    ve.start_at,
    ve.end_at,
    coalesce(
      nullif(p.organization_name, ''),
      nullif(p.display_name, ''),
      'Unknown Organization'
    ) as organization,
    coalesce(cbe.max_volunteers, 0) as max_volunteers,
    greatest(coalesce(cbe.max_volunteers, 0) - coalesce(obe.occupied_slots, 0), 0)::int as vacancies,
    case
      when ve.status = 'done' or ve.end_at < now() then 'done'
      else 'open'
    end as state
  from visible_events ve
  left join public.profiles p on p.id = ve.created_by
  left join capacity_by_event cbe on cbe.event_id = ve.id
  left join occupancy_by_event obe on obe.event_id = ve.id
  order by ve.start_at asc;
$$;

revoke all on function public.get_campaign_dashboard() from public;
grant execute on function public.get_campaign_dashboard() to authenticated, service_role;

drop view if exists public.users_with_roles;

create view public.users_with_roles as
select
  au.id,
  au.email as auth_email,
  p.email as profile_email,
  p.first_name,
  p.last_name,
  p.user_type,
  p.organization_name,
  p.campaign_manager,
  au.created_at
from auth.users au
left join public.profiles p on p.id = au.id
order by au.created_at desc;
