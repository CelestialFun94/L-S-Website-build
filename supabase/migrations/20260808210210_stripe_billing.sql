create or replace function private.can_manage_billing()
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.profiles
    where user_id = (select auth.uid())
      and active = true
      and role in ('owner', 'admin', 'finance')
  );
$$;
revoke execute on function private.can_manage_billing() from public, anon, authenticated, service_role;
grant execute on function private.can_manage_billing() to authenticated;

alter table public.invoices
  add column if not exists description text,
  add column if not exists currency text not null default 'usd',
  add column if not exists paid_cents bigint not null default 0 check (paid_cents >= 0),
  add column if not exists billing_type text not null default 'one_time'
    check (billing_type in ('one_time', 'payment_plan', 'retainer')),
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_invoice_id text unique,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_checkout_session_id text,
  add column if not exists hosted_invoice_url text,
  add column if not exists invoice_pdf_url text,
  add column if not exists payment_url text,
  add column if not exists last_payment_at timestamptz,
  add column if not exists last_error text;

alter table public.invoices drop constraint if exists invoices_status_check;
alter table public.invoices add constraint invoices_status_check
  check (status in ('draft', 'open', 'sent', 'partially_paid', 'paid', 'past_due', 'overdue', 'void', 'uncollectible'));

create table if not exists public.stripe_customers (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists(id) on delete cascade,
  stripe_customer_id text not null unique,
  email text,
  livemode boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (artist_id, livemode)
);

create table if not exists public.payment_plans (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null unique references public.invoices(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete restrict,
  installment_amount_cents bigint not null check (installment_amount_cents > 0),
  installment_count integer not null check (installment_count between 2 and 36),
  interval text not null default 'month' check (interval in ('week', 'month')),
  currency text not null default 'usd',
  status text not null default 'pending' check (status in ('pending', 'active', 'past_due', 'complete', 'canceled')),
  stripe_price_id text,
  stripe_checkout_session_id text unique,
  stripe_subscription_id text unique,
  stripe_schedule_id text unique,
  checkout_url text,
  installments_paid integer not null default 0 check (installments_paid >= 0),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.retainers (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists(id) on delete restrict,
  invoice_id uuid references public.invoices(id) on delete set null,
  description text not null,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'usd',
  interval text not null default 'month' check (interval in ('week', 'month', 'year')),
  status text not null default 'pending' check (status in ('pending', 'active', 'past_due', 'paused', 'canceled')),
  stripe_price_id text,
  stripe_checkout_session_id text unique,
  stripe_subscription_id text unique,
  checkout_url text,
  current_period_end timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references public.invoices(id) on delete set null,
  artist_id uuid references public.artists(id) on delete set null,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  stripe_invoice_id text unique,
  amount_cents bigint not null check (amount_cents >= 0),
  refunded_cents bigint not null default 0 check (refunded_cents >= 0),
  currency text not null default 'usd',
  status text not null check (status in ('pending', 'succeeded', 'failed', 'refunded', 'partially_refunded')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (stripe_payment_intent_id, stripe_invoice_id)
);

create table if not exists public.stripe_webhook_events (
  id text primary key,
  event_type text not null,
  object_id text,
  livemode boolean not null default false,
  status text not null default 'processing' check (status in ('processing', 'processed', 'failed')),
  attempts integer not null default 1,
  error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists payment_plans_artist_status_idx on public.payment_plans (artist_id, status);
create index if not exists retainers_artist_status_idx on public.retainers (artist_id, status);
create index if not exists payments_invoice_created_idx on public.payments (invoice_id, created_at desc);
create unique index if not exists payments_payment_intent_unique_idx on public.payments (stripe_payment_intent_id) where stripe_payment_intent_id is not null;
create unique index if not exists payments_charge_unique_idx on public.payments (stripe_charge_id) where stripe_charge_id is not null;
create index if not exists stripe_webhook_events_status_received_idx on public.stripe_webhook_events (status, received_at desc);

alter table public.stripe_customers enable row level security;
alter table public.payment_plans enable row level security;
alter table public.retainers enable row level security;
alter table public.payments enable row level security;
alter table public.stripe_webhook_events enable row level security;

drop policy if exists invoices_internal_all on public.invoices;
drop policy if exists invoices_internal_read on public.invoices;
drop policy if exists invoices_billing_write on public.invoices;
create policy invoices_internal_read on public.invoices for select to authenticated
using ((select private.is_internal_user()));
create policy invoices_billing_write on public.invoices for all to authenticated
using ((select private.can_manage_billing())) with check ((select private.can_manage_billing()));

drop policy if exists stripe_customers_internal_read on public.stripe_customers;
drop policy if exists stripe_customers_billing_write on public.stripe_customers;
drop policy if exists payment_plans_internal_read on public.payment_plans;
drop policy if exists payment_plans_billing_write on public.payment_plans;
drop policy if exists retainers_internal_read on public.retainers;
drop policy if exists retainers_billing_write on public.retainers;
drop policy if exists payments_internal_read on public.payments;
drop policy if exists payments_billing_write on public.payments;

create policy stripe_customers_internal_read on public.stripe_customers for select to authenticated
using ((select private.is_internal_user()));
create policy stripe_customers_billing_write on public.stripe_customers for all to authenticated
using ((select private.can_manage_billing())) with check ((select private.can_manage_billing()));
create policy payment_plans_internal_read on public.payment_plans for select to authenticated
using ((select private.is_internal_user()));
create policy payment_plans_billing_write on public.payment_plans for all to authenticated
using ((select private.can_manage_billing())) with check ((select private.can_manage_billing()));
create policy retainers_internal_read on public.retainers for select to authenticated
using ((select private.is_internal_user()));
create policy retainers_billing_write on public.retainers for all to authenticated
using ((select private.can_manage_billing())) with check ((select private.can_manage_billing()));
create policy payments_internal_read on public.payments for select to authenticated
using ((select private.is_internal_user()));
create policy payments_billing_write on public.payments for all to authenticated
using ((select private.can_manage_billing())) with check ((select private.can_manage_billing()));

revoke all on public.stripe_customers, public.payment_plans, public.retainers, public.payments, public.stripe_webhook_events from anon, authenticated;
grant select, insert, update on public.stripe_customers, public.payment_plans, public.retainers, public.payments to authenticated;
grant select, insert, update, delete on public.invoices, public.artists to service_role;
grant select, insert, update, delete on public.stripe_customers, public.payment_plans, public.retainers, public.payments, public.stripe_webhook_events to service_role;

drop trigger if exists stripe_customers_set_updated_at on public.stripe_customers;
drop trigger if exists payment_plans_set_updated_at on public.payment_plans;
drop trigger if exists retainers_set_updated_at on public.retainers;
drop trigger if exists payments_set_updated_at on public.payments;

create trigger stripe_customers_set_updated_at before update on public.stripe_customers for each row execute function private.set_updated_at();
create trigger payment_plans_set_updated_at before update on public.payment_plans for each row execute function private.set_updated_at();
create trigger retainers_set_updated_at before update on public.retainers for each row execute function private.set_updated_at();
create trigger payments_set_updated_at before update on public.payments for each row execute function private.set_updated_at();
