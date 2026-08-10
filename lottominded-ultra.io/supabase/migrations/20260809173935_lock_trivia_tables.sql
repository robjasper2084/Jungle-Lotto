drop policy if exists trivia_sessions_service_only on public.trivia_sessions;
create policy trivia_sessions_service_only
  on public.trivia_sessions
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists trivia_answers_service_only on public.trivia_answers;
create policy trivia_answers_service_only
  on public.trivia_answers
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists trivia_reward_claims_service_only on public.trivia_reward_claims;
create policy trivia_reward_claims_service_only
  on public.trivia_reward_claims
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);
