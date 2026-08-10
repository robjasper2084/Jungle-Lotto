-- Keep the Data API on a deny-by-default footing. All account, billing,
-- wallet, catalog, and analytics access flows through audited Edge functions.
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.wallets from anon, authenticated;
revoke all on table public.memberships from anon, authenticated;
revoke all on table public.collector_redemptions from anon, authenticated;
revoke all on table public.credit_transactions from anon, authenticated;
revoke all on table public.billing_events from anon, authenticated;
revoke all on table public.analytics_events from anon, authenticated;
revoke all on table public.plan_catalog from anon, authenticated;

-- The GET-only news Edge function intentionally uses the anon client and an
-- existing published-row RLS policy.
revoke all on table public.news_articles from anon, authenticated;
grant select on table public.news_articles to anon, authenticated;

revoke all on sequence public.analytics_events_id_seq from anon, authenticated;

-- Trigger helpers do not need to be callable through PostgREST.
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.news_articles_set_updated_at() from public, anon, authenticated;

-- New database objects must be opted into Data API access explicitly.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;
