create table if not exists public.trivia_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_id text not null,
  build_id text not null,
  mode text not null check (mode = 'daily'),
  expected_sequence integer not null default 0 check (expected_sequence between 0 and 5),
  correct_count integer not null default 0 check (correct_count between 0 and 5),
  question_count integer not null default 5 check (question_count = 5),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  claimed_at timestamptz
);

create index if not exists trivia_sessions_user_created_idx
  on public.trivia_sessions (user_id, created_at desc);

create table if not exists public.trivia_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.trivia_sessions(id) on delete cascade,
  sequence integer not null check (sequence between 0 and 4),
  question_id text not null,
  selected_index integer not null check (selected_index between -1 and 3),
  elapsed_ms integer not null check (elapsed_ms between 0 and 60000),
  correct boolean not null,
  answered_at timestamptz not null default now(),
  unique (session_id, sequence),
  unique (session_id, question_id)
);

create table if not exists public.trivia_reward_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.trivia_sessions(id) on delete cascade,
  challenge_id text not null,
  amount integer not null check (amount between 5 and 20),
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (session_id),
  unique (user_id, challenge_id),
  unique (user_id, idempotency_key)
);

alter table public.trivia_sessions enable row level security;
alter table public.trivia_answers enable row level security;
alter table public.trivia_reward_claims enable row level security;

revoke all on public.trivia_sessions from anon, authenticated;
revoke all on public.trivia_answers from anon, authenticated;
revoke all on public.trivia_reward_claims from anon, authenticated;
grant all on public.trivia_sessions to service_role;
grant all on public.trivia_answers to service_role;
grant all on public.trivia_reward_claims to service_role;

create or replace function public.record_trivia_answer(
  p_user_id uuid,
  p_session_id uuid,
  p_sequence integer,
  p_question_id text,
  p_selected_index integer,
  p_correct boolean,
  p_elapsed_ms integer
)
returns table(next_sequence integer, correct_count integer)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_session public.trivia_sessions%rowtype;
begin
  select * into v_session
    from public.trivia_sessions
   where id = p_session_id and user_id = p_user_id
   for update;
  if not found or v_session.expires_at <= now() or v_session.claimed_at is not null
     or v_session.expected_sequence <> p_sequence or p_sequence < 0 or p_sequence >= v_session.question_count
     or p_selected_index < -1 or p_selected_index > 3
     or p_elapsed_ms < 0 or p_elapsed_ms > 60000 then
    raise exception 'INVALID_STATE_TRANSITION';
  end if;

  insert into public.trivia_answers (session_id, sequence, question_id, selected_index, correct, elapsed_ms)
  values (p_session_id, p_sequence, p_question_id, p_selected_index, p_correct, p_elapsed_ms);
  update public.trivia_sessions
     set expected_sequence = expected_sequence + 1,
         correct_count = correct_count + case when p_correct then 1 else 0 end
   where id = p_session_id
   returning expected_sequence, trivia_sessions.correct_count into next_sequence, correct_count;
  return next;
end;
$$;

revoke all on function public.record_trivia_answer(uuid, uuid, integer, text, integer, boolean, integer) from public, anon, authenticated;
grant execute on function public.record_trivia_answer(uuid, uuid, integer, text, integer, boolean, integer) to service_role;

create or replace function public.award_trivia_credits(
  p_user_id uuid,
  p_session_id uuid,
  p_challenge_id text,
  p_idempotency_key text
)
returns table(transaction_id uuid, balance integer, amount integer, duplicate boolean)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_session public.trivia_sessions%rowtype;
  v_claim public.trivia_reward_claims%rowtype;
  v_amount integer;
  v_balance integer;
begin
  if p_idempotency_key !~ '^[a-zA-Z0-9:_-]{8,128}$' then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;

  select * into v_claim
    from public.trivia_reward_claims
   where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if found then
    select w.balance into v_balance from public.wallets w where w.user_id = p_user_id;
    return query select v_claim.id, coalesce(v_balance, 0), v_claim.amount, true;
    return;
  end if;

  select * into v_session
    from public.trivia_sessions
   where id = p_session_id and user_id = p_user_id
   for update;
  if not found or v_session.expires_at <= now() or v_session.claimed_at is not null
     or v_session.challenge_id <> p_challenge_id
     or v_session.expected_sequence <> v_session.question_count then
    raise exception 'INVALID_STATE_TRANSITION';
  end if;

  if exists (
    select 1 from public.trivia_reward_claims
     where user_id = p_user_id and challenge_id = p_challenge_id
  ) then
    raise exception 'DAILY_REWARD_ALREADY_CLAIMED';
  end if;

  v_amount := 5
    + case when v_session.correct_count::numeric / v_session.question_count >= 0.8 then 5 else 0 end
    + case when v_session.correct_count = v_session.question_count then 10 else 0 end;
  v_amount := least(v_amount, 20);
  insert into public.trivia_reward_claims (user_id, session_id, challenge_id, amount, idempotency_key)
  values (p_user_id, p_session_id, p_challenge_id, v_amount, p_idempotency_key)
  returning * into v_claim;

  insert into public.wallets (user_id, balance, updated_at)
  values (p_user_id, v_amount, now())
  on conflict (user_id) do update
    set balance = public.wallets.balance + excluded.balance,
        updated_at = now()
  returning public.wallets.balance into v_balance;

  update public.trivia_sessions set claimed_at = now() where id = p_session_id;
  return query select v_claim.id, v_balance, v_amount, false;
end;
$$;

revoke all on function public.award_trivia_credits(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.award_trivia_credits(uuid, uuid, text, text) to service_role;
