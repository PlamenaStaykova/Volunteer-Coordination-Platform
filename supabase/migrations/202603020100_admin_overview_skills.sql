-- Extend admin dashboard overview with campaign required skills and volunteer profile skills.

create or replace function public.admin_get_dashboard_overview()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  overview jsonb;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Not authorized';
  end if;

  with organizers as (
    select
      p.id,
      coalesce(nullif(p.display_name, ''), split_part(coalesce(au.email, ''), '@', 1), 'Organizer') as name,
      au.email,
      coalesce(
        jsonb_agg(
          distinct jsonb_build_object(
            'id', e.id,
            'title', e.title,
            'start_at', e.start_at,
            'end_at', e.end_at,
            'location', e.location,
            'requiredSkills', coalesce(e.required_skills, '{}'::text[])
          )
        ) filter (where e.id is not null),
        '[]'::jsonb
      ) as campaigns_created
    from public.profiles p
    left join auth.users au on au.id = p.id
    left join public.events e on e.created_by = p.id
    where p.auth_role = 'organizer'
    group by p.id, p.display_name, au.email
  ),
  volunteer_event_links as (
    select distinct
      ss.user_id,
      s.event_id
    from public.shift_signups ss
    join public.shifts s on s.id = ss.shift_id
    where ss.status in ('signed', 'attended')
  ),
  volunteers as (
    select
      p.id,
      coalesce(nullif(p.display_name, ''), split_part(coalesce(au.email, ''), '@', 1), 'Volunteer') as name,
      au.email,
      coalesce(p.volunteer_skills, '{}'::text[]) as volunteer_skills,
      coalesce(
        jsonb_agg(
          distinct jsonb_build_object(
            'id', e.id,
            'title', e.title,
            'start_at', e.start_at,
            'end_at', e.end_at,
            'location', e.location,
            'requiredSkills', coalesce(e.required_skills, '{}'::text[])
          )
        ) filter (where e.id is not null),
        '[]'::jsonb
      ) as campaigns_participating
    from public.profiles p
    left join auth.users au on au.id = p.id
    left join volunteer_event_links vel on vel.user_id = p.id
    left join public.events e on e.id = vel.event_id
    where p.auth_role = 'volunteer'
    group by p.id, p.display_name, au.email, p.volunteer_skills
  )
  select jsonb_build_object(
    'organizers',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', o.id,
            'name', o.name,
            'email', o.email,
            'campaignsCreated', o.campaigns_created
          )
          order by o.name, o.email
        )
        from organizers o
      ),
      '[]'::jsonb
    ),
    'volunteers',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', v.id,
            'name', v.name,
            'email', v.email,
            'volunteerSkills', coalesce(v.volunteer_skills, '{}'::text[]),
            'campaignsParticipating', v.campaigns_participating
          )
          order by v.name, v.email
        )
        from volunteers v
      ),
      '[]'::jsonb
    )
  )
  into overview;

  return coalesce(overview, jsonb_build_object('organizers', '[]'::jsonb, 'volunteers', '[]'::jsonb));
end;
$$;

revoke all on function public.admin_get_dashboard_overview() from public;
grant execute on function public.admin_get_dashboard_overview() to authenticated, service_role;
