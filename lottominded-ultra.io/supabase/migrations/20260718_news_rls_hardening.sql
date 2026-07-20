drop policy if exists "news articles are public" on public.news_articles;
drop policy if exists "members can read premium news" on public.news_articles;

create policy "anonymous users can read public news"
on public.news_articles
for select
to anon
using (status = 'published' and is_premium = false);

create policy "signed in users can read entitled news"
on public.news_articles
for select
to authenticated
using (
  status = 'published'
  and (
    is_premium = false
    or exists (
      select 1
      from public.memberships m
      where m.user_id = (select auth.uid())
        and m.status in ('active', 'trialing')
        and m.plan_code in ('gold', 'ultra', 'vault', 'guardian_bundle')
        and (m.current_period_end is null or m.current_period_end > now())
    )
  )
);

revoke all on function public.has_active_news_membership(uuid) from public, anon, authenticated;
drop function if exists public.has_active_news_membership(uuid);
