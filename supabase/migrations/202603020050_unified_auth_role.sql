-- Unified auth role source of truth for app authorization.
-- Adds profiles.auth_role enum and keeps admin/user-type helpers aligned.

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'auth_role_enum'
      and n.nspname = 'public'
  ) then
    create type public.auth_role_enum as enum ('admin', 'organizer', 'volunteer');
  end if;
end
$$;

alter table public.profiles
add column if not exists auth_role public.auth_role_enum;

update public.profiles p
set auth_role = 'admin'::public.auth_role_enum
where exists (
  select 1
  from public.user_roles ur
  where ur.user_id = p.id
    and ur.role = 'admin'
);

update public.profiles p
set auth_role = case
  when p.user_type::text = 'organizer' then 'organizer'::public.auth_role_enum
  else 'volunteer'::public.auth_role_enum
end
where p.auth_role is null;

alter table public.profiles
alter column auth_role set default 'volunteer'::public.auth_role_enum;

alter table public.profiles
alter column auth_role set not null;

create index if not exists idx_profiles_auth_role on public.profiles(auth_role);

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.profiles p
      where p.id = uid
        and p.auth_role = 'admin'
    )
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = uid
        and ur.role = 'admin'
    );
$$;

revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to anon, authenticated, service_role;

create or replace function public.is_organizer(uid uuid)
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
        and p.auth_role = 'organizer'
    )
    or exists (
      select 1
      from auth.users au
      where au.id = uid
        and lower(coalesce(au.raw_user_meta_data ->> 'user_type', '')) = 'organizer'
    );
$$;

revoke all on function public.is_organizer(uuid) from public;
grant execute on function public.is_organizer(uuid) to anon, authenticated, service_role;

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
        and p.auth_role = 'volunteer'
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

  insert into public.profiles (id, display_name, user_type, auth_role, email)
  values (
    new.id,
    resolved_display_name,
    resolved_role::public.user_type_enum,
    resolved_role::public.auth_role_enum,
    resolved_email
  )
  on conflict (id) do update
  set
    user_type = excluded.user_type,
    auth_role = case
      when public.profiles.auth_role = 'admin' then public.profiles.auth_role
      else excluded.auth_role
    end,
    email = coalesce(nullif(public.profiles.email, ''), excluded.email),
    display_name = coalesce(nullif(public.profiles.display_name, ''), excluded.display_name);

  return new;
end;
$$;

create or replace function public.admin_update_user(
  p_user_id uuid,
  p_display_name text,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_user_type text,
  p_is_admin boolean
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_role text;
  v_auth_role public.auth_role_enum;
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
    volunteer_skills = case when v_role = 'volunteer' then volunteer_skills else '{}'::text[] end
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

revoke all on function public.admin_update_user(uuid, text, text, text, text, text, boolean) from public;
grant execute on function public.admin_update_user(uuid, text, text, text, text, text, boolean) to authenticated, service_role;

update public.profiles p
set auth_role = 'admin'::public.auth_role_enum
where exists (
  select 1
  from public.user_roles ur
  where ur.user_id = p.id
    and ur.role = 'admin'
);
