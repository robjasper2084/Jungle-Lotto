-- LottoMind account, commerce, entitlement, and append-only credit foundation.
-- Browser clients may read their own account state. All mutations are reserved
-- for server-side functions using the service role.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  stripe_customer_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists stripe_customer_id text;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

create table if not exists public.plan_catalog (
  lookup_key text primary key,
  plan_code text not null,
  price_type text not null check (price_type in ('recurring', 'one_time')),
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'usd',
  available boolean not null default false,
  stripe_price_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.plan_catalog add column if not exists lookup_key text;
alter table public.plan_catalog add column if not exists plan_code text;
alter table public.plan_catalog add column if not exists price_type text;
alter table public.plan_catalog add column if not exists amount_cents integer;
alter table public.plan_catalog add column if not exists currency text default 'usd';
alter table public.plan_catalog add column if not exists available boolean default false;
alter table public.plan_catalog add column if not exists stripe_price_id text;
alter table public.plan_catalog add column if not exists created_at timestamptz default now();
alter table public.plan_catalog add column if not exists updated_at timestamptz default now();

create table if not exists public.subscriptions (
  subscription_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('stripe', 'collector', 'manual')),
  provider_customer_id text,
  provider_subscription_id text unique,
  plan_code text not null,
  status text not null check (status in ('incomplete', 'trialing', 'active', 'past_due', 'paused', 'canceled', 'expired')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  provider_event_created_at timestamptz,
  cancel_at_period_end boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions add column if not exists provider_event_created_at timestamptz;

create table if not exists public.entitlements (
  entitlement_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entitlement_code text not null,
  active boolean not null default true,
  source_type text not null check (source_type in ('subscription', 'collector', 'order', 'manual')),
  source_id text not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entitlement_code, source_type, source_id)
);

create table if not exists public.credit_ledger (
  entry_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_delta integer not null check (amount_delta <> 0),
  reason text not null check (char_length(reason) between 1 and 120),
  source_id text not null check (char_length(source_id) between 1 and 200),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 200),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create table if not exists public.collector_codes (
  collector_code_id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  status text not null default 'available' check (status in ('available', 'redeemed', 'disabled', 'expired')),
  plan_code text not null default 'guardian_bundle',
  access_months integer not null default 3 check (access_months between 1 and 60),
  credit_amount integer not null default 150 check (credit_amount >= 0),
  entitlement_codes text[] not null default array['guardian_bundle']::text[],
  redeemed_by uuid references auth.users(id) on delete set null,
  redeemed_at timestamptz,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.game_reward_events (
  reward_event_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_code text not null,
  event_type text not null,
  source_id text not null,
  idempotency_key text not null,
  credit_amount integer not null default 0 check (credit_amount >= 0),
  verification_status text not null default 'pending' check (verification_status in ('pending', 'verified', 'rejected')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  unique (user_id, idempotency_key)
);

create table if not exists public.orders (
  order_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'stripe',
  provider_order_id text not null unique,
  payment_intent_id text,
  plan_code text,
  status text not null check (status in ('open', 'paid', 'complete', 'refunded', 'canceled', 'failed')),
  amount_total integer,
  currency text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.downloads (
  download_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_key text not null,
  entitlement_code text,
  source_id text not null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create index if not exists subscriptions_user_status_idx on public.subscriptions (user_id, status, current_period_end desc);
create index if not exists entitlements_user_active_idx on public.entitlements (user_id, active, ends_at);
create index if not exists credit_ledger_user_created_idx on public.credit_ledger (user_id, created_at desc);
create index if not exists collector_codes_redeemed_by_idx on public.collector_codes (redeemed_by);
create index if not exists game_reward_events_user_created_idx on public.game_reward_events (user_id, created_at desc);
create index if not exists orders_user_created_idx on public.orders (user_id, created_at desc);
create index if not exists downloads_user_created_idx on public.downloads (user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.plan_catalog enable row level security;
alter table public.subscriptions enable row level security;
alter table public.entitlements enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.collector_codes enable row level security;
alter table public.game_reward_events enable row level security;
alter table public.orders enable row level security;
alter table public.downloads enable row level security;

drop policy if exists "members read own profile" on public.profiles;
create policy "members read own profile" on public.profiles for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "members read own subscriptions" on public.subscriptions;
create policy "members read own subscriptions" on public.subscriptions for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "members read own entitlements" on public.entitlements;
create policy "members read own entitlements" on public.entitlements for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "members read own credit ledger" on public.credit_ledger;
create policy "members read own credit ledger" on public.credit_ledger for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "members read own reward events" on public.game_reward_events;
create policy "members read own reward events" on public.game_reward_events for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "members read own orders" on public.orders;
create policy "members read own orders" on public.orders for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "members read own downloads" on public.downloads;
create policy "members read own downloads" on public.downloads for select to authenticated
using ((select auth.uid()) = user_id);

revoke all on public.profiles, public.plan_catalog, public.subscriptions, public.entitlements, public.credit_ledger,
  public.collector_codes, public.game_reward_events, public.orders, public.downloads from anon, authenticated;
grant select on public.profiles, public.subscriptions, public.entitlements, public.credit_ledger,
  public.game_reward_events, public.orders, public.downloads to authenticated;

create or replace function public.prevent_credit_ledger_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'credit_ledger is append-only; add a compensating entry instead';
end;
$$;

drop trigger if exists credit_ledger_append_only on public.credit_ledger;
create trigger credit_ledger_append_only
before update or delete on public.credit_ledger
for each row execute function public.prevent_credit_ledger_mutation();

create or replace function public.spend_credits(
  p_user_id uuid,
  p_amount integer,
  p_reason text,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_entry public.credit_ledger%rowtype;
  current_balance bigint;
  created_entry public.credit_ledger%rowtype;
begin
  if p_user_id is null or p_amount <= 0 or char_length(trim(p_idempotency_key)) < 8 then
    raise exception 'invalid credit spend request';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  select * into existing_entry from public.credit_ledger
    where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if found then
    select coalesce(sum(amount_delta), 0) into current_balance from public.credit_ledger where user_id = p_user_id;
    return jsonb_build_object('entryId', existing_entry.entry_id, 'balance', current_balance, 'idempotent', true);
  end if;

  select coalesce(sum(amount_delta), 0) into current_balance from public.credit_ledger where user_id = p_user_id;
  if current_balance < p_amount then raise exception 'insufficient credits'; end if;

  insert into public.credit_ledger (user_id, amount_delta, reason, source_id, idempotency_key, metadata)
  values (p_user_id, -p_amount, p_reason, 'account-action:' || p_reason, p_idempotency_key, p_metadata)
  returning * into created_entry;

  return jsonb_build_object('entryId', created_entry.entry_id, 'balance', current_balance - p_amount, 'amountDelta', -p_amount, 'idempotent', false);
end;
$$;

create or replace function public.credit_balance_for_user(p_user_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(amount_delta), 0)::bigint
  from public.credit_ledger
  where user_id = p_user_id;
$$;

create or replace function public.refund_credits(
  p_user_id uuid,
  p_transaction_id text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  original public.credit_ledger%rowtype;
  existing_entry public.credit_ledger%rowtype;
  current_balance bigint;
  created_entry public.credit_ledger%rowtype;
begin
  if p_user_id is null or p_transaction_id !~* '^[0-9a-f-]{36}$' or char_length(trim(p_idempotency_key)) < 8 then
    raise exception 'invalid credit refund request';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  select * into existing_entry from public.credit_ledger
    where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if found then
    select coalesce(sum(amount_delta), 0) into current_balance from public.credit_ledger where user_id = p_user_id;
    return jsonb_build_object('entryId', existing_entry.entry_id, 'balance', current_balance, 'idempotent', true);
  end if;

  select * into original from public.credit_ledger
    where user_id = p_user_id and entry_id = p_transaction_id::uuid and amount_delta < 0;
  if not found then raise exception 'credit transaction not found'; end if;

  insert into public.credit_ledger (user_id, amount_delta, reason, source_id, idempotency_key, metadata)
  values (p_user_id, -original.amount_delta, 'refund:' || original.reason, original.entry_id::text, p_idempotency_key,
    jsonb_build_object('refundedEntryId', original.entry_id))
  returning * into created_entry;

  select coalesce(sum(amount_delta), 0) into current_balance from public.credit_ledger where user_id = p_user_id;
  return jsonb_build_object('entryId', created_entry.entry_id, 'balance', current_balance, 'amountDelta', created_entry.amount_delta, 'idempotent', false);
end;
$$;

create or replace function public.redeem_collector_code(
  p_user_id uuid,
  p_code_hash text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  code public.collector_codes%rowtype;
  subscription_end timestamptz;
  entitlement_code text;
begin
  if p_user_id is null or char_length(p_code_hash) < 32 or char_length(trim(p_idempotency_key)) < 8 then
    raise exception 'invalid collector redemption request';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_code_hash, 0));
  select * into code from public.collector_codes where code_hash = p_code_hash for update;
  if not found or code.status <> 'available' or (code.expires_at is not null and code.expires_at <= now()) then
    raise exception 'collector code is unavailable';
  end if;

  subscription_end := now() + make_interval(months => code.access_months);
  update public.collector_codes set status = 'redeemed', redeemed_by = p_user_id, redeemed_at = now()
    where collector_code_id = code.collector_code_id;

  insert into public.subscriptions (user_id, provider, provider_subscription_id, plan_code, status, current_period_start, current_period_end, metadata)
  values (p_user_id, 'collector', 'collector:' || code.collector_code_id, code.plan_code, 'active', now(), subscription_end,
    jsonb_build_object('collectorCodeId', code.collector_code_id));

  foreach entitlement_code in array code.entitlement_codes loop
    insert into public.entitlements (user_id, entitlement_code, source_type, source_id, starts_at, ends_at)
    values (p_user_id, entitlement_code, 'collector', code.collector_code_id::text, now(), subscription_end)
    on conflict (user_id, entitlement_code, source_type, source_id)
    do update set active = true, ends_at = excluded.ends_at, updated_at = now();
  end loop;

  if code.credit_amount > 0 then
    insert into public.credit_ledger (user_id, amount_delta, reason, source_id, idempotency_key, metadata)
    values (p_user_id, code.credit_amount, 'collector_redemption', code.collector_code_id::text, p_idempotency_key,
      jsonb_build_object('collectorCodeId', code.collector_code_id));
  end if;

  return jsonb_build_object('redeemed', true, 'planCode', code.plan_code, 'complimentaryUntil', subscription_end, 'creditAmount', code.credit_amount);
end;
$$;

revoke all on function public.prevent_credit_ledger_mutation() from public, anon, authenticated;
revoke all on function public.credit_balance_for_user(uuid) from public, anon, authenticated;
revoke all on function public.spend_credits(uuid, integer, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.refund_credits(uuid, text, text) from public, anon, authenticated;
revoke all on function public.redeem_collector_code(uuid, text, text) from public, anon, authenticated;
grant execute on function public.spend_credits(uuid, integer, text, text, jsonb) to service_role;
grant execute on function public.credit_balance_for_user(uuid) to service_role;
grant execute on function public.refund_credits(uuid, text, text) to service_role;
grant execute on function public.redeem_collector_code(uuid, text, text) to service_role;

create or replace function public.create_lottomind_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', 'LottoMind Member'))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists create_lottomind_profile_after_signup on auth.users;
create trigger create_lottomind_profile_after_signup
after insert on auth.users
for each row execute function public.create_lottomind_profile();

revoke all on function public.create_lottomind_profile() from public, anon, authenticated;
