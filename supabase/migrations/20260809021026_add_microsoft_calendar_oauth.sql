create table if not exists public.oauth_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  provider text not null check (provider in ('microsoft')),
  account_email text not null,
  tenant_id text,
  access_token_encrypted text not null,
  refresh_token_encrypted text not null,
  token_expires_at timestamptz not null,
  scopes text[] not null default '{}',
  calendar_id text,
  calendar_name text,
  status text not null default 'connected' check (status in ('connected', 'needs_attention', 'disabled')),
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create index if not exists oauth_connections_user_provider_idx
  on public.oauth_connections (user_id, provider);

alter table public.oauth_connections enable row level security;
revoke all on public.oauth_connections from public, anon, authenticated;
grant select, insert, update, delete on public.oauth_connections to service_role;

create trigger oauth_connections_set_updated_at
before update on public.oauth_connections
for each row execute function private.set_updated_at();
