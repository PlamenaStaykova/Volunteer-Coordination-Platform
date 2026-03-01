-- Fix organizer RLS mismatch for existing accounts.
-- Some users have organizer role in auth metadata but not in profiles yet.

update public.profiles p
set user_type = 'organizer'
from auth.users au
where au.id = p.id
  and lower(coalesce(au.raw_user_meta_data ->> 'user_type', '')) = 'organizer'
  and p.user_type <> 'organizer';

update public.profiles p
set user_type = 'volunteer'
from auth.users au
where au.id = p.id
  and lower(coalesce(au.raw_user_meta_data ->> 'user_type', '')) = 'volunteer'
  and p.user_type <> 'volunteer';

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
        and p.user_type = 'organizer'
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
