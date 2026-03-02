-- Distinguish organizer invitations from volunteer self-applications.

alter table public.shift_signups
add column if not exists signup_source text not null default 'applied';

update public.shift_signups
set signup_source = 'applied'
where signup_source is null;

alter table public.shift_signups
drop constraint if exists shift_signups_signup_source_check;

alter table public.shift_signups
add constraint shift_signups_signup_source_check
check (signup_source in ('applied', 'invited'));
