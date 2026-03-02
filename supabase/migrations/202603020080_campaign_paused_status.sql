-- Add paused campaign status between open and done/ended.

alter table public.events
drop constraint if exists events_status_check;

alter table public.events
add constraint events_status_check
check (status in ('draft', 'published', 'paused', 'done', 'cancelled'));

drop policy if exists "events_select_published_public" on public.events;
create policy "events_select_published_public"
on public.events
for select
to public
using (status in ('published', 'paused', 'done'));

drop policy if exists "events_select_own_or_admin" on public.events;
create policy "events_select_own_or_admin"
on public.events
for select
to authenticated
using (
  status in ('published', 'paused', 'done')
  or created_by = auth.uid()
  or public.is_admin(auth.uid())
);

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
      and e.status in ('published', 'paused', 'done')
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
    where e.status in ('published', 'paused', 'done')
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
      when ve.status = 'paused' then 'paused'
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

create or replace function public.get_public_campaign_overview()
returns table (
  id uuid,
  title text,
  description text,
  organization text,
  start_at timestamptz,
  end_at timestamptz,
  state text,
  volunteers_participated int
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
      e.created_by,
      e.start_at,
      e.end_at,
      e.status
    from public.events e
    where e.status in ('published', 'paused', 'done')
  ),
  participants_by_event as (
    select
      s.event_id,
      count(distinct ss.user_id) filter (where ss.status in ('signed', 'attended'))::int as volunteers_participated
    from public.shifts s
    join visible_events ve on ve.id = s.event_id
    left join public.shift_signups ss on ss.shift_id = s.id
    group by s.event_id
  )
  select
    ve.id,
    ve.title,
    ve.description,
    coalesce(
      nullif(p.organization_name, ''),
      nullif(p.display_name, ''),
      'Unknown Organization'
    ) as organization,
    ve.start_at,
    ve.end_at,
    case
      when ve.status = 'done' or ve.end_at < now() then 'ended'
      when ve.status = 'paused' then 'paused'
      else 'ongoing'
    end as state,
    coalesce(pbe.volunteers_participated, 0) as volunteers_participated
  from visible_events ve
  left join public.profiles p on p.id = ve.created_by
  left join participants_by_event pbe on pbe.event_id = ve.id
  order by
    case
      when ve.status = 'done' or ve.end_at < now() then 2
      when ve.status = 'paused' then 1
      else 0
    end asc,
    ve.start_at desc;
$$;

revoke all on function public.get_public_campaign_overview() from public;
grant execute on function public.get_public_campaign_overview() to anon, authenticated, service_role;
