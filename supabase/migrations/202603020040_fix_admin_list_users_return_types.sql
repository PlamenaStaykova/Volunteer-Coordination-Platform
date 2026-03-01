-- Fix admin_list_users RPC return type mismatch by explicit casting.

create or replace function public.admin_list_users()
returns table (
  user_id uuid,
  email text,
  created_at timestamptz,
  display_name text,
  first_name text,
  last_name text,
  phone text,
  user_type text,
  is_admin boolean
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
    public.is_admin(au.id)::boolean as is_admin
  from auth.users au
  left join public.profiles p on p.id = au.id
  order by au.created_at desc;
end;
$$;

revoke all on function public.admin_list_users() from public;
grant execute on function public.admin_list_users() to authenticated, service_role;
