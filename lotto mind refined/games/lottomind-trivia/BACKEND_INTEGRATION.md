# Secure backend integration contract

This plan fits the existing LottoMind account service and shared credit ledger. It can be implemented in the project's backend or a protected Supabase Edge Function. Do not enable frontend reward flags until every endpoint and database constraint below is deployed and tested.

## Data model

- `trivia_questions`: full schema, private correct index, review status, editor account, edit timestamp, and active version. Admin-only writes through role checks and row-level security.
- `trivia_daily_challenges`: UTC challenge date, public opaque challenge ID, server-selected question IDs, server seed version, and publication timestamp. Unique by challenge date.
- `trivia_sessions`: opaque session ID, authenticated user ID, mode, challenge ID, assigned question IDs/order, issued/expiry timestamps, status, and risk flags.
- `trivia_session_answers`: session ID, sequence, question ID, selected index, server-received timing, correctness, and awarded score. Unique by session and sequence.
- `trivia_reward_claims`: user ID, challenge ID, credits, claim timestamp, and idempotency key. Unique on `(user_id, challenge_id)` and idempotency key.
- existing shared credit-ledger table: one authoritative credit transaction referencing the reward claim.

## Endpoints

1. `POST /api/trivia/sessions`
   - Requires authentication for a credit-eligible Daily run.
   - Creates an expiring session and returns only assigned question text and choices, never correct indexes.
   - Daily questions come from a cryptographically secure server seed, avoid recent repeats, and are stored before return.
2. `POST /api/trivia/sessions/:id/answers`
   - Accepts question ID, selected index, sequence, and client elapsed timing.
   - Confirms assignment and sequence, uses server receive time for risk checks, calculates correctness and score, then returns feedback for that submitted question.
3. `POST /api/trivia/sessions/:id/complete`
   - Recalculates the entire session server-side.
   - Enforces one claim per account/challenge and the 20-credit daily cap.
   - Writes the trivia claim and shared credit-ledger entry in one transaction using an idempotency key.
   - Returns authoritative score, reward, claim state, and refreshed account snapshot.
4. `GET /api/trivia/leaderboards?board=daily&cursor=…`
   - Returns paginated, server-validated entries with sanitized display names and no email.
5. Protected admin CRUD/import/export endpoints
   - Require an authenticated admin role, validate the schema server-side, and record editor ID and timestamp.

## Proposed credit rules

Completion: 5 credits; 80% or higher: 5 more; perfect Daily: 10 more; maximum 20 per account per UTC day. Additional attempts return score only. Guests cannot create a reward-eligible session.

## Shared balance refresh

After a successful claim, return the normal LottoMind account snapshot and broadcast the same account-refresh event/channel used by `LottoMindAccountService`. LottoMind Refined and Lottominded-Ultra must read the authoritative refreshed wallet rather than applying a client-side increment.

## Abuse and observability

Log expired or altered sessions, duplicate sequences, duplicate claims, impossible completion timing, unassigned question IDs, and repeated idempotency-key mismatches. Rate-limit session creation and answer submission by account and network signal without storing unnecessary profile data.

## Activation gate

Only after integration tests prove session expiry, answer order, duplicate prevention, cap enforcement, transactional idempotency, account authentication, and cross-app balance refresh may `serverDailySelection`, `authoritativeCredits`, `remoteLeaderboards`, and `profileBadgeSync` be enabled.
