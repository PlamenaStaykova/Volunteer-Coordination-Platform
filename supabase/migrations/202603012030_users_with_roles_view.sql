-- Convenience view for Supabase dashboard to inspect user roles in one place.
-- Note: auth.users itself keeps custom role data in raw_user_meta_data JSON.

create or replace view public.users_with_roles as
select
  au.id,
  au.email,
  p.display_name,
  p.user_type,
  au.created_at
from auth.users au
left join public.profiles p on p.id = au.id
order by au.created_at desc;
