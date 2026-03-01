-- Enforce user type with a dedicated enum instead of free text.

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'user_type_enum'
      and n.nspname = 'public'
  ) then
    create type public.user_type_enum as enum ('organizer', 'volunteer');
  end if;
end
$$;

alter table public.profiles
add column if not exists user_type text;

update public.profiles
set user_type = lower(coalesce(user_type, 'volunteer'));

update public.profiles
set user_type = 'volunteer'
where user_type not in ('organizer', 'volunteer');

alter table public.profiles
drop constraint if exists profiles_user_type_check;

alter table public.profiles
alter column user_type type public.user_type_enum
using user_type::public.user_type_enum;

alter table public.profiles
alter column user_type set default 'volunteer'::public.user_type_enum;

alter table public.profiles
alter column user_type set not null;

create index if not exists idx_profiles_user_type on public.profiles(user_type);

create or replace function public.sync_profile_from_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  resolved_role text;
  resolved_display_name text;
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

  insert into public.profiles (id, display_name, user_type)
  values (new.id, resolved_display_name, resolved_role::public.user_type_enum)
  on conflict (id) do update
  set
    user_type = excluded.user_type,
    display_name = coalesce(public.profiles.display_name, excluded.display_name);

  return new;
end;
$$;
