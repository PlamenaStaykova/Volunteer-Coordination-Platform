-- Add volunteer skills profile field with allowed predefined values.

alter table public.profiles
add column if not exists volunteer_skills text[] not null default '{}'::text[];

update public.profiles
set volunteer_skills = '{}'::text[]
where volunteer_skills is null;

alter table public.profiles
drop constraint if exists profiles_volunteer_skills_allowed;

alter table public.profiles
add constraint profiles_volunteer_skills_allowed
check (
  volunteer_skills <@ array[
    'Time Management',
    'First Aid',
    'Communication',
    'Teamwork',
    'Event Planning',
    'Child Care',
    'Elderly Care',
    'Fundraising',
    'Logistics Coordination',
    'Public Speaking'
  ]::text[]
);
