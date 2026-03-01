-- Keep bootstrap admin email elevated even if user is re-created later.

create or replace function public.ensure_bootstrap_admin()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if lower(coalesce(new.email, '')) = 'plamena@gmail.com' then
    insert into public.user_roles (user_id, role)
    values (new.id, 'admin')
    on conflict (user_id, role) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_bootstrap_admin on auth.users;
create trigger on_auth_user_bootstrap_admin
after insert or update of email
on auth.users
for each row execute function public.ensure_bootstrap_admin();

insert into public.user_roles (user_id, role)
select au.id, 'admin'
from auth.users au
where lower(coalesce(au.email, '')) = 'plamena@gmail.com'
on conflict (user_id, role) do nothing;
