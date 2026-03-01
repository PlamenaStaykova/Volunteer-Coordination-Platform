-- Campaign dashboard data for authenticated users.
-- Exposes safe aggregated metrics without revealing signup identities.

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
  with published_events as (
    select
      e.id,
      e.title,
      e.description,
      e.location,
      e.start_at,
      e.end_at,
      e.created_by
    from public.events e
    where e.status = 'published'
  ),
  capacity_by_event as (
    select
      s.event_id,
      coalesce(sum(s.capacity), 0)::int as max_volunteers
    from public.shifts s
    join published_events pe on pe.id = s.event_id
    group by s.event_id
  ),
  occupancy_by_event as (
    select
      s.event_id,
      count(ss.id) filter (where ss.status in ('signed', 'attended'))::int as occupied_slots
    from public.shifts s
    join published_events pe on pe.id = s.event_id
    left join public.shift_signups ss on ss.shift_id = s.id
    group by s.event_id
  )
  select
    pe.id,
    pe.title,
    pe.description,
    pe.location,
    pe.start_at,
    pe.end_at,
    coalesce(p.display_name, 'Unknown Organization') as organization,
    coalesce(cbe.max_volunteers, 0) as max_volunteers,
    greatest(coalesce(cbe.max_volunteers, 0) - coalesce(obe.occupied_slots, 0), 0)::int as vacancies,
    case
      when pe.end_at < now() then 'done'
      else 'open'
    end as state
  from published_events pe
  left join public.profiles p on p.id = pe.created_by
  left join capacity_by_event cbe on cbe.event_id = pe.id
  left join occupancy_by_event obe on obe.event_id = pe.id
  order by pe.start_at asc;
$$;

revoke all on function public.get_campaign_dashboard() from public;
grant execute on function public.get_campaign_dashboard() to authenticated, service_role;
