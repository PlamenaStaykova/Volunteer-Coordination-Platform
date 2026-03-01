-- Add explicit user type to profiles and auto-sync from auth users metadata.

alter table public.profiles
add column if not exists user_type text;

update public.profiles p
set user_type = lower(au.raw_user_meta_data ->> 'user_type')
from auth.users au
where au.id = p.id
  and lower(coalesce(au.raw_user_meta_data ->> 'user_type', '')) in ('organizer', 'volunteer');

update public.profiles
set user_type = 'organizer'
where user_type is null
  and lower(coalesce(display_name, '')) like '%organizer%';

update public.profiles
set user_type = 'volunteer'
where user_type is null
  and (
    lower(coalesce(display_name, '')) like '%volunteer%'
    or lower(coalesce(display_name, '')) like '%experienced%'
  );

update public.profiles p
set user_type = 'organizer'
where user_type is null
  and exists (
    select 1
    from public.events e
    where e.created_by = p.id
  );

update public.profiles
set user_type = 'volunteer'
where user_type is null;

alter table public.profiles
alter column user_type set default 'volunteer';

alter table public.profiles
alter column user_type set not null;

alter table public.profiles
drop constraint if exists profiles_user_type_check;

alter table public.profiles
add constraint profiles_user_type_check
check (user_type in ('organizer', 'volunteer'));

create index if not exists idx_profiles_user_type on public.profiles(user_type);

update auth.users au
set raw_user_meta_data = coalesce(au.raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('user_type', p.user_type)
from public.profiles p
where p.id = au.id
  and coalesce(lower(au.raw_user_meta_data ->> 'user_type'), '') not in ('organizer', 'volunteer');

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
  values (new.id, resolved_display_name, resolved_role)
  on conflict (id) do update
  set
    user_type = excluded.user_type,
    display_name = coalesce(public.profiles.display_name, excluded.display_name);

  return new;
end;
$$;

drop trigger if exists on_auth_user_synced_to_profile on auth.users;
create trigger on_auth_user_synced_to_profile
after insert or update of raw_user_meta_data, email
on auth.users
for each row execute function public.sync_profile_from_auth_user();
