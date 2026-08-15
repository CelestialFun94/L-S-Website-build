alter table public.inquiries
  add column if not exists availability text,
  add column if not exists time_zone text;

alter table public.inquiries
  drop constraint if exists inquiries_time_zone_check,
  add constraint inquiries_time_zone_check
  check (time_zone is null or time_zone in ('ET', 'CT', 'MT', 'PT', 'AKT', 'HT'));
