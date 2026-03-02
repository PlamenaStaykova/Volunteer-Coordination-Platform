-- Allow admins to edit volunteer skills and expose skills in admin user listing.

drop function if exists public.admin_list_users();

create function public.admin_list_users()
returns table (
  user_id uuid,
  email text,
  created_at timestamptz,
  display_name text,
  first_name text,
  last_name text,
  phone text,
  user_type text,
  is_admin boolean,
  volunteer_skills text[]
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Not authorized';
  end if;

  return query
  select
    au.id::uuid as user_id,
    au.email::text as email,
    au.created_at::timestamptz as created_at,
    p.display_name::text as display_name,
    p.first_name::text as first_name,
    p.last_name::text as last_name,
    p.phone::text as phone,
    p.user_type::text as user_type,
    public.is_admin(au.id)::boolean as is_admin,
    coalesce(p.volunteer_skills, '{}'::text[])::text[] as volunteer_skills
  from auth.users au
  left join public.profiles p on p.id = au.id
  order by au.created_at desc;
end;
$$;

revoke all on function public.admin_list_users() from public;
grant execute on function public.admin_list_users() to authenticated, service_role;

drop function if exists public.admin_update_user(uuid, text, text, text, text, text, boolean);

create function public.admin_update_user(
  p_user_id uuid,
  p_display_name text,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_user_type text,
  p_is_admin boolean,
  p_volunteer_skills text[] default null
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_role text;
  v_auth_role public.auth_role_enum;
  v_skills text[];
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Not authorized';
  end if;

  v_role := lower(coalesce(p_user_type, 'volunteer'));
  if v_role not in ('organizer', 'volunteer') then
    raise exception 'Invalid user type';
  end if;

  v_auth_role := case
    when coalesce(p_is_admin, false) then 'admin'::public.auth_role_enum
    when v_role = 'organizer' then 'organizer'::public.auth_role_enum
    else 'volunteer'::public.auth_role_enum
  end;

  select coalesce(
    array_agg(distinct btrim(skill)),
    '{}'::text[]
  )
  into v_skills
  from unnest(coalesce(p_volunteer_skills, '{}'::text[])) as skill
  where btrim(skill) <> '';

  update public.profiles
  set
    display_name = coalesce(nullif(p_display_name, ''), display_name),
    first_name = nullif(p_first_name, ''),
    last_name = nullif(p_last_name, ''),
    phone = nullif(p_phone, ''),
    user_type = v_role::public.user_type_enum,
    auth_role = v_auth_role,
    organization_name = case when v_role = 'organizer' then organization_name else null end,
    campaign_manager = case when v_role = 'organizer' then campaign_manager else null end,
    volunteer_skills = case when v_role = 'volunteer' then v_skills else '{}'::text[] end
  where id = p_user_id;

  update auth.users
  set raw_user_meta_data =
    coalesce(raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object('user_type', v_role)
    || jsonb_build_object('display_name', coalesce(nullif(p_display_name, ''), split_part(email, '@', 1)))
  where id = p_user_id;

  if coalesce(p_is_admin, false) then
    insert into public.user_roles (user_id, role)
    values (p_user_id, 'admin')
    on conflict (user_id, role) do nothing;
  else
    if p_user_id <> auth.uid() then
      delete from public.user_roles where user_id = p_user_id and role = 'admin';
    end if;
  end if;
end;
$$;

revoke all on function public.admin_update_user(uuid, text, text, text, text, text, boolean, text[]) from public;
grant execute on function public.admin_update_user(uuid, text, text, text, text, text, boolean, text[]) to authenticated, service_role;
