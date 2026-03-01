-- Include done campaigns in dashboard data and mark state from explicit status.

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
    coalesce(p.display_name, 'Unknown Organization') as organization,
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
