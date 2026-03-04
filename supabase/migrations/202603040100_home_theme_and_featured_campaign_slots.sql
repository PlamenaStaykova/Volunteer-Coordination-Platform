-- Home page theme assets and featured campaign slot assignment.
-- Admins manage theme images and campaign-to-slot mapping.

create table if not exists public.home_theme_assets (
  asset_key text primary key,
  asset_path text not null,
  asset_url text not null,
  updated_by uuid not null references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now(),
  constraint home_theme_assets_asset_key_check
    check (asset_key in ('hero_background', 'gallery_background'))
);

alter table public.home_theme_assets enable row level security;

drop policy if exists "home_theme_assets_select_public" on public.home_theme_assets;
create policy "home_theme_assets_select_public"
on public.home_theme_assets
for select
to public
using (true);

drop policy if exists "home_theme_assets_admin_manage" on public.home_theme_assets;
create policy "home_theme_assets_admin_manage"
on public.home_theme_assets
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create table if not exists public.home_campaign_slots (
  slot_key text primary key,
  slot_label text not null,
  slot_order int not null unique,
  campaign_id uuid references public.events(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_home_campaign_slots_campaign_id
  on public.home_campaign_slots(campaign_id);

insert into public.home_campaign_slots (slot_key, slot_label, slot_order)
values
  ('hero_feature', 'Hero Feature', 0),
  ('community_support', 'Community Support', 1),
  ('education_drive', 'Education Drive', 2),
  ('health_outreach', 'Health Outreach', 3),
  ('emergency_response', 'Emergency Response', 4)
on conflict (slot_key) do update
set
  slot_label = excluded.slot_label,
  slot_order = excluded.slot_order;

alter table public.home_campaign_slots enable row level security;

drop policy if exists "home_campaign_slots_select_public" on public.home_campaign_slots;
create policy "home_campaign_slots_select_public"
on public.home_campaign_slots
for select
to public
using (true);

drop policy if exists "home_campaign_slots_admin_manage" on public.home_campaign_slots;
create policy "home_campaign_slots_admin_manage"
on public.home_campaign_slots
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create or replace function public.get_home_theme_assets()
returns table (
  asset_key text,
  asset_path text,
  asset_url text,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    hta.asset_key,
    hta.asset_path,
    hta.asset_url,
    hta.updated_at
  from public.home_theme_assets hta
  order by hta.asset_key asc;
$$;

revoke all on function public.get_home_theme_assets() from public;
grant execute on function public.get_home_theme_assets() to anon, authenticated, service_role;

create or replace function public.get_home_campaign_slots()
returns table (
  slot_key text,
  slot_label text,
  slot_order int,
  campaign_id uuid,
  campaign_title text,
  campaign_state text,
  campaign_cover_image_path text,
  campaign_organization text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    hcs.slot_key,
    hcs.slot_label,
    hcs.slot_order,
    e.id as campaign_id,
    e.title as campaign_title,
    case
      when e.id is null then null
      when e.status = 'done' or e.end_at < now() then 'ended'
      when e.status = 'paused' then 'paused'
      else 'ongoing'
    end as campaign_state,
    e.cover_image_path as campaign_cover_image_path,
    coalesce(
      nullif(p.organization_name, ''),
      nullif(p.display_name, ''),
      'Unknown Organization'
    ) as campaign_organization
  from public.home_campaign_slots hcs
  left join public.events e
    on e.id = hcs.campaign_id
    and e.status in ('published', 'paused', 'done')
  left join public.profiles p on p.id = e.created_by
  order by hcs.slot_order asc;
$$;

revoke all on function public.get_home_campaign_slots() from public;
grant execute on function public.get_home_campaign_slots() to anon, authenticated, service_role;

drop policy if exists "event_covers_auth_insert" on storage.objects;
create policy "event_covers_auth_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'event-covers'
  and (
    coalesce((storage.foldername(name))[1], '') = auth.uid()::text
    or public.is_admin(auth.uid())
  )
);
