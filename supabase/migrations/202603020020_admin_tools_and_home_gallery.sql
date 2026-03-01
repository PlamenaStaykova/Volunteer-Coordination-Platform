-- Admin tools: user management + home page gallery management.
-- Also promote plamena@gmail.com to admin.

insert into public.user_roles (user_id, role)
select au.id, 'admin'
from auth.users au
where lower(coalesce(au.email, '')) = 'plamena@gmail.com'
on conflict (user_id, role) do nothing;

create table if not exists public.home_gallery_images (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  image_path text not null,
  image_url text not null,
  sort_order int not null default 0,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_home_gallery_images_sort_order
  on public.home_gallery_images(sort_order, created_at);

alter table public.home_gallery_images enable row level security;

drop policy if exists "home_gallery_images_select_public" on public.home_gallery_images;
create policy "home_gallery_images_select_public"
on public.home_gallery_images
for select
to public
using (true);

drop policy if exists "home_gallery_images_admin_manage" on public.home_gallery_images;
create policy "home_gallery_images_admin_manage"
on public.home_gallery_images
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

insert into storage.buckets (id, name, public)
values ('home-gallery', 'home-gallery', true)
on conflict (id) do nothing;

drop policy if exists "home_gallery_public_read" on storage.objects;
create policy "home_gallery_public_read"
on storage.objects
for select
to public
using (bucket_id = 'home-gallery');

drop policy if exists "home_gallery_admin_insert" on storage.objects;
create policy "home_gallery_admin_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'home-gallery'
  and public.is_admin(auth.uid())
);

drop policy if exists "home_gallery_admin_update" on storage.objects;
create policy "home_gallery_admin_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'home-gallery'
  and public.is_admin(auth.uid())
)
with check (
  bucket_id = 'home-gallery'
  and public.is_admin(auth.uid())
);

drop policy if exists "home_gallery_admin_delete" on storage.objects;
create policy "home_gallery_admin_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'home-gallery'
  and public.is_admin(auth.uid())
);

create or replace function public.get_home_gallery_images()
returns table (
  id uuid,
  title text,
  image_url text,
  image_path text,
  sort_order int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    hgi.id,
    hgi.title,
    hgi.image_url,
    hgi.image_path,
    hgi.sort_order
  from public.home_gallery_images hgi
  order by hgi.sort_order asc, hgi.created_at asc;
$$;

revoke all on function public.get_home_gallery_images() from public;
grant execute on function public.get_home_gallery_images() to anon, authenticated, service_role;

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
    au.id as user_id,
    au.email,
    au.created_at,
    p.display_name,
    p.first_name,
    p.last_name,
    p.phone,
    p.user_type::text,
    public.is_admin(au.id) as is_admin
  from auth.users au
  left join public.profiles p on p.id = au.id
  order by au.created_at desc;
end;
$$;

revoke all on function public.admin_list_users() from public;
grant execute on function public.admin_list_users() to authenticated, service_role;

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
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Not authorized';
  end if;

  v_role := lower(coalesce(p_user_type, 'volunteer'));
  if v_role not in ('organizer', 'volunteer') then
    raise exception 'Invalid user type';
  end if;

  update public.profiles
  set
    display_name = coalesce(nullif(p_display_name, ''), display_name),
    first_name = nullif(p_first_name, ''),
    last_name = nullif(p_last_name, ''),
    phone = nullif(p_phone, ''),
    user_type = v_role::public.user_type_enum,
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

create or replace function public.admin_delete_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Not authorized';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'Admin cannot delete own account';
  end if;

  delete from auth.users where id = p_user_id;
end;
$$;

revoke all on function public.admin_delete_user(uuid) from public;
grant execute on function public.admin_delete_user(uuid) to authenticated, service_role;
