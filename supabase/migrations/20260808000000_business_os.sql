create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 120),
  role text not null default 'read_only' check (role in ('owner', 'admin', 'operations', 'finance', 'read_only')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('starter', 'cowrite')),
  name text not null check (char_length(name) between 2 and 120),
  email text not null check (char_length(email) between 3 and 320),
  path text,
  idea text,
  status text not null default 'new' check (status in ('new', 'reviewing', 'contacted', 'closed')),
  source text not null default 'website',
  consent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.artists (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  email text,
  stage text,
  status text not null default 'active' check (status in ('lead', 'active', 'paused', 'archived')),
  next_step text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 160),
  project_type text,
  status text not null default 'planning' check (status in ('planning', 'active', 'blocked', 'complete', 'archived')),
  target_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.songs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  status text not null default 'draft' check (status in ('draft', 'writing', 'recording', 'mixing', 'mastered', 'released')),
  split_status text not null default 'not_started' check (split_status in ('not_started', 'pending', 'confirmed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.song_contributors (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references public.songs(id) on delete cascade,
  contributor_name text not null,
  contributor_email text,
  share_percent numeric(5,2) not null check (share_percent >= 0 and share_percent <= 100),
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists(id) on delete restrict,
  invoice_number text not null unique,
  amount_cents bigint not null check (amount_cents >= 0),
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'overdue', 'void')),
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inquiries_status_created_idx on public.inquiries (status, created_at desc);
create index if not exists projects_artist_id_idx on public.projects (artist_id);
create index if not exists projects_status_created_idx on public.projects (status, created_at desc);
create index if not exists songs_project_id_idx on public.songs (project_id);
create index if not exists song_contributors_song_id_idx on public.song_contributors (song_id);
create index if not exists invoices_artist_id_idx on public.invoices (artist_id);
create index if not exists invoices_status_due_idx on public.invoices (status, due_date);

create or replace function private.is_internal_user()
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.profiles
    where user_id = (select auth.uid()) and active = true
  );
$$;
revoke execute on function private.is_internal_user() from public, anon, authenticated, service_role;
grant usage on schema private to authenticated;
grant execute on function private.is_internal_user() to authenticated;

alter table public.profiles enable row level security;
alter table public.inquiries enable row level security;
alter table public.artists enable row level security;
alter table public.projects enable row level security;
alter table public.songs enable row level security;
alter table public.song_contributors enable row level security;
alter table public.invoices enable row level security;

create policy profiles_read_self_or_internal on public.profiles for select to authenticated
using ((select auth.uid()) = user_id or (select private.is_internal_user()));
create policy inquiries_public_create on public.inquiries for insert to anon
with check (source = 'website' and status = 'new' and char_length(name) between 2 and 120 and char_length(email) between 3 and 320);
create policy inquiries_internal_all on public.inquiries for all to authenticated
using ((select private.is_internal_user())) with check ((select private.is_internal_user()));
create policy artists_internal_all on public.artists for all to authenticated
using ((select private.is_internal_user())) with check ((select private.is_internal_user()));
create policy projects_internal_all on public.projects for all to authenticated
using ((select private.is_internal_user())) with check ((select private.is_internal_user()));
create policy songs_internal_all on public.songs for all to authenticated
using ((select private.is_internal_user())) with check ((select private.is_internal_user()));
create policy song_contributors_internal_all on public.song_contributors for all to authenticated
using ((select private.is_internal_user())) with check ((select private.is_internal_user()));
create policy invoices_internal_all on public.invoices for all to authenticated
using ((select private.is_internal_user())) with check ((select private.is_internal_user()));

revoke all on all tables in schema public from anon, authenticated;
grant insert on public.inquiries to anon;
grant select on public.profiles to authenticated;
grant select, insert, update on public.inquiries, public.artists, public.projects, public.songs, public.song_contributors, public.invoices to authenticated;

create or replace function private.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
revoke execute on function private.set_updated_at() from public, anon, authenticated;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function private.set_updated_at();
create trigger inquiries_set_updated_at before update on public.inquiries for each row execute function private.set_updated_at();
create trigger artists_set_updated_at before update on public.artists for each row execute function private.set_updated_at();
create trigger projects_set_updated_at before update on public.projects for each row execute function private.set_updated_at();
create trigger songs_set_updated_at before update on public.songs for each row execute function private.set_updated_at();
create trigger invoices_set_updated_at before update on public.invoices for each row execute function private.set_updated_at();
