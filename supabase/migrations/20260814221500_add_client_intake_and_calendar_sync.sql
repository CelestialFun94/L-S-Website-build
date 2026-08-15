create table if not exists public.intake_requests (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists(id) on delete cascade,
  created_by uuid references public.profiles(user_id) on delete set null,
  recipient_email text not null check (char_length(recipient_email) between 3 and 320),
  token_hash text not null unique check (char_length(token_hash) = 64),
  status text not null default 'sent' check (status in ('sent', 'completed', 'expired', 'revoked')),
  sent_at timestamptz not null default now(),
  expires_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > sent_at)
);

create table if not exists public.intake_responses (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.intake_requests(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  responses jsonb not null default '{}'::jsonb,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(responses) = 'object')
);

create index if not exists intake_requests_artist_sent_idx
  on public.intake_requests (artist_id, sent_at desc);
create index if not exists intake_requests_status_expires_idx
  on public.intake_requests (status, expires_at);
create index if not exists intake_responses_artist_updated_idx
  on public.intake_responses (artist_id, updated_at desc);
create unique index if not exists bookings_provider_event_unique_idx
  on public.bookings (provider, provider_event_id);

alter table public.intake_requests enable row level security;
alter table public.intake_responses enable row level security;

revoke all on public.intake_requests, public.intake_responses from public, anon, authenticated;
grant select, insert, update, delete on public.intake_requests, public.intake_responses to service_role;

create trigger intake_requests_set_updated_at
before update on public.intake_requests
for each row execute function private.set_updated_at();

create trigger intake_responses_set_updated_at
before update on public.intake_responses
for each row execute function private.set_updated_at();
