-- Public campaign overview for non-authenticated visitors.
-- Includes ongoing and ended campaigns with volunteer participation counts.

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
    where e.status in ('published', 'done')
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
      else 'ongoing'
    end as state,
    coalesce(pbe.volunteers_participated, 0) as volunteers_participated
  from visible_events ve
  left join public.profiles p on p.id = ve.created_by
  left join participants_by_event pbe on pbe.event_id = ve.id
  order by
    case when ve.status = 'done' or ve.end_at < now() then 1 else 0 end asc,
    ve.start_at desc;
$$;

revoke all on function public.get_public_campaign_overview() from public;
grant execute on function public.get_public_campaign_overview() to anon, authenticated, service_role;
