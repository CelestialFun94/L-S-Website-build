alter table public.artists
  add column if not exists phone text,
  add column if not exists pronouns text,
  add column if not exists genres text,
  add column if not exists lead_source text,
  add column if not exists notes text;

alter table public.projects
  add column if not exists description text,
  add column if not exists priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  add column if not exists progress integer not null default 0
    check (progress between 0 and 100),
  add column if not exists next_step text;

alter table public.songs
  add column if not exists alternate_title text,
  add column if not exists genre text,
  add column if not exists musical_key text,
  add column if not exists bpm integer check (bpm is null or bpm between 20 and 300),
  add column if not exists iswc text,
  add column if not exists release_date date,
  add column if not exists notes text;

alter table public.song_contributors
  add column if not exists contributor_role text not null default 'songwriter',
  add column if not exists pro_affiliation text,
  add column if not exists publisher text;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  artist_id uuid references public.artists(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 240),
  description text,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'waiting', 'complete', 'canceled')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  due_date date,
  assigned_user_id uuid references public.profiles(user_id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid references public.artists(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  actor_user_id uuid references public.profiles(user_id) on delete set null,
  activity_type text not null default 'note' check (activity_type in ('note', 'call', 'email', 'meeting', 'status_change', 'billing', 'file', 'system')),
  summary text not null check (char_length(summary) between 2 and 500),
  detail text,
  created_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid references public.artists(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  title text not null check (char_length(title) between 2 and 200),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text,
  provider text not null default 'manual' check (provider in ('manual', 'google', 'microsoft')),
  provider_event_id text,
  status text not null default 'tentative' check (status in ('tentative', 'confirmed', 'completed', 'canceled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.file_records (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid references public.artists(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  name text not null check (char_length(name) between 1 and 255),
  object_key text,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  storage_provider text not null default 'repository' check (storage_provider in ('repository', 'r2')),
  status text not null default 'available' check (status in ('pending', 'available', 'archived', 'quarantined')),
  notes text,
  created_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vault_links (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid references public.artists(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  service_name text not null check (char_length(service_name) between 2 and 120),
  manager_name text not null default 'External password manager',
  item_reference text,
  login_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  provider text not null unique check (provider in ('supabase', 'vercel', 'stripe', 'resend', 'google_calendar', 'microsoft_calendar', 'cloudflare_r2', 'openai', 'chase')),
  display_name text not null,
  status text not null default 'not_configured' check (status in ('connected', 'not_configured', 'needs_attention', 'disabled')),
  account_label text,
  last_checked_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.operator_items (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.profiles(user_id) on delete set null,
  item_type text not null default 'capture' check (item_type in ('capture', 'brief', 'draft', 'review', 'decision')),
  title text not null check (char_length(title) between 2 and 200),
  content text,
  risk_level text not null default 'read_only' check (risk_level in ('read_only', 'internal_write', 'approval_required', 'forbidden')),
  status text not null default 'open' check (status in ('open', 'draft', 'approved', 'completed', 'dismissed')),
  related_type text,
  related_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles(user_id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  outcome text not null default 'success' check (outcome in ('success', 'denied', 'failed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists tasks_project_status_idx on public.tasks (project_id, status);
create index if not exists tasks_artist_due_idx on public.tasks (artist_id, due_date);
create index if not exists tasks_assigned_status_idx on public.tasks (assigned_user_id, status);
create index if not exists activities_artist_created_idx on public.activities (artist_id, created_at desc);
create index if not exists activities_project_created_idx on public.activities (project_id, created_at desc);
create index if not exists bookings_starts_status_idx on public.bookings (starts_at, status);
create index if not exists bookings_artist_idx on public.bookings (artist_id);
create index if not exists file_records_artist_idx on public.file_records (artist_id);
create index if not exists file_records_project_idx on public.file_records (project_id);
create index if not exists vault_links_artist_idx on public.vault_links (artist_id);
create index if not exists vault_links_project_idx on public.vault_links (project_id);
create index if not exists operator_items_status_created_idx on public.operator_items (status, created_at desc);
create index if not exists audit_events_actor_created_idx on public.audit_events (actor_user_id, created_at desc);
create index if not exists audit_events_target_idx on public.audit_events (target_type, target_id, created_at desc);

alter table public.tasks enable row level security;
alter table public.activities enable row level security;
alter table public.bookings enable row level security;
alter table public.file_records enable row level security;
alter table public.vault_links enable row level security;
alter table public.integration_connections enable row level security;
alter table public.operator_items enable row level security;
alter table public.audit_events enable row level security;

create policy tasks_internal_all on public.tasks for all to authenticated
using ((select private.is_internal_user())) with check ((select private.is_internal_user()));
create policy activities_internal_all on public.activities for all to authenticated
using ((select private.is_internal_user())) with check ((select private.is_internal_user()));
create policy bookings_internal_all on public.bookings for all to authenticated
using ((select private.is_internal_user())) with check ((select private.is_internal_user()));
create policy file_records_internal_all on public.file_records for all to authenticated
using ((select private.is_internal_user())) with check ((select private.is_internal_user()));
create policy vault_links_internal_all on public.vault_links for all to authenticated
using ((select private.is_internal_user())) with check ((select private.is_internal_user()));
create policy integration_connections_internal_read on public.integration_connections for select to authenticated
using ((select private.is_internal_user()));
create policy operator_items_internal_all on public.operator_items for all to authenticated
using ((select private.is_internal_user())) with check ((select private.is_internal_user()));
create policy audit_events_internal_read_insert on public.audit_events for select to authenticated
using ((select private.is_internal_user()));
create policy audit_events_internal_insert on public.audit_events for insert to authenticated
with check ((select private.is_internal_user()) and actor_user_id = (select auth.uid()));

revoke all on public.tasks, public.activities, public.bookings, public.file_records, public.vault_links,
  public.integration_connections, public.operator_items, public.audit_events from anon, authenticated;
grant select, insert, update on public.tasks, public.activities, public.bookings, public.file_records,
  public.vault_links, public.operator_items to authenticated;
grant select on public.integration_connections to authenticated;
grant select, insert on public.audit_events to authenticated;
grant select, insert, update, delete on public.tasks, public.activities, public.bookings, public.file_records,
  public.vault_links, public.integration_connections, public.operator_items, public.audit_events to service_role;

create trigger tasks_set_updated_at before update on public.tasks for each row execute function private.set_updated_at();
create trigger bookings_set_updated_at before update on public.bookings for each row execute function private.set_updated_at();
create trigger file_records_set_updated_at before update on public.file_records for each row execute function private.set_updated_at();
create trigger vault_links_set_updated_at before update on public.vault_links for each row execute function private.set_updated_at();
create trigger integration_connections_set_updated_at before update on public.integration_connections for each row execute function private.set_updated_at();
create trigger operator_items_set_updated_at before update on public.operator_items for each row execute function private.set_updated_at();

insert into public.integration_connections (provider, display_name, status, notes)
values
  ('supabase', 'Supabase', 'connected', 'Database and authentication'),
  ('vercel', 'Vercel', 'connected', 'Hosting, functions, and deployment'),
  ('stripe', 'Stripe', 'connected', 'Invoices, payment plans, retainers, and webhooks'),
  ('resend', 'Resend', 'not_configured', 'Transactional email'),
  ('google_calendar', 'Google Calendar', 'not_configured', 'Availability and booking'),
  ('microsoft_calendar', 'Microsoft 365 / Outlook', 'not_configured', 'Unified availability'),
  ('cloudflare_r2', 'Cloudflare R2', 'not_configured', 'Private artist and project files'),
  ('openai', 'Sunshine Operator', 'not_configured', 'Controlled AI workspace tools'),
  ('chase', 'Chase', 'not_configured', 'Reconciliation method must be confirmed')
on conflict (provider) do nothing;
