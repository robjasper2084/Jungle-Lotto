create table if not exists public.news_articles (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  title text not null,
  url text not null check (url ~* '^https?://'),
  canonical_url text,
  source_name text not null,
  source_homepage text,
  source_trust_level text,
  source_type text,
  source_url text,
  categories text[] not null default '{}',
  published_at timestamptz,
  snippet text,
  brief text,
  verification_language text,
  official_verification_language text,
  import_method text,
  automated boolean not null default false,
  generated_at timestamptz,
  status text not null default 'published'
    check (status in ('draft', 'published', 'archived')),
  is_premium boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists news_articles_published_idx
  on public.news_articles (status, published_at desc nulls last);
create index if not exists news_articles_categories_idx
  on public.news_articles using gin (categories);
create index if not exists news_articles_premium_idx
  on public.news_articles (is_premium, status);

create or replace function public.news_articles_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists news_articles_updated_at on public.news_articles;
create trigger news_articles_updated_at
before update on public.news_articles
for each row execute function public.news_articles_set_updated_at();

create or replace function public.has_active_news_membership(target_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    target_user is not null
    and target_user = auth.uid()
    and exists (
      select 1
      from public.memberships m
      where m.user_id = target_user
        and m.status in ('active', 'trialing')
        and m.plan_code in ('gold', 'ultra', 'vault', 'guardian_bundle')
        and (m.current_period_end is null or m.current_period_end > now())
    );
$$;

alter table public.news_articles enable row level security;

drop policy if exists "news articles are public" on public.news_articles;
create policy "news articles are public"
on public.news_articles
for select
to anon, authenticated
using (status = 'published' and is_premium = false);

drop policy if exists "members can read premium news" on public.news_articles;
create policy "members can read premium news"
on public.news_articles
for select
to authenticated
using (
  status = 'published'
  and is_premium = true
  and public.has_active_news_membership(auth.uid())
);

revoke all on function public.has_active_news_membership(uuid) from public;
grant execute on function public.has_active_news_membership(uuid) to authenticated;
grant select on public.news_articles to anon, authenticated;
