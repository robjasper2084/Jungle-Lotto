-- Canonical launch products remain unavailable until an owner attaches a
-- verified Stripe Price in the matching Stripe mode and explicitly enables it.
insert into public.plan_catalog (lookup_key, plan_code, price_type, amount_cents, currency, available, stripe_price_id)
values
  ('gold_monthly', 'gold', 'recurring', 499, 'usd', false, null),
  ('gold_yearly', 'gold', 'recurring', 4900, 'usd', false, null),
  ('ultra_monthly', 'ultra', 'recurring', 999, 'usd', false, null),
  ('ultra_yearly', 'ultra', 'recurring', 9900, 'usd', false, null),
  ('guardian_bundle_once', 'guardian_bundle', 'one_time', 2995, 'usd', false, null)
on conflict (lookup_key) do update set
  plan_code = excluded.plan_code,
  price_type = excluded.price_type,
  amount_cents = excluded.amount_cents,
  currency = excluded.currency,
  updated_at = now();

create or replace function public.has_active_entitlement(
  p_user_id uuid,
  p_entitlement_code text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.entitlements
    where user_id = p_user_id
      and entitlement_code = lower(trim(p_entitlement_code))
      and active = true
      and starts_at <= now()
      and (ends_at is null or ends_at > now())
  );
$$;

revoke all on function public.has_active_entitlement(uuid, text) from public, anon, authenticated;
grant execute on function public.has_active_entitlement(uuid, text) to service_role;

-- RLS still limits change events to the authenticated user's own ledger rows.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'credit_ledger'
    ) then
    alter publication supabase_realtime add table public.credit_ledger;
  end if;
end;
$$;
