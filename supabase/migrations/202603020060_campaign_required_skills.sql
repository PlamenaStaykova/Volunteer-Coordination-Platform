-- Add required skills to campaigns using the same allowed set as volunteer profile skills.

alter table public.events
add column if not exists required_skills text[] not null default '{}'::text[];

update public.events
set required_skills = '{}'::text[]
where required_skills is null;

alter table public.events
drop constraint if exists events_required_skills_allowed;

alter table public.events
add constraint events_required_skills_allowed
check (
  required_skills <@ array[
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
