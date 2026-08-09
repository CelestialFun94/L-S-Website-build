alter table public.inquiries
  add column if not exists phone text,
  add column if not exists contact_preference text;

alter table public.inquiries
  drop constraint if exists inquiries_contact_preference_check,
  add constraint inquiries_contact_preference_check
  check (contact_preference is null or contact_preference in ('sms', 'email'));
