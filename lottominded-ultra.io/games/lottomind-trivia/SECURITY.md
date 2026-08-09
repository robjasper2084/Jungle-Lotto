# Trivia Security Boundary

## Current Static Build

All secure Trivia service flags are `false`. The browser can calculate entertainment points and store private guest records, but it cannot issue LottoCredits, write account badges, submit verified rankings, or assert that a score is authoritative.

The browser-side reward helpers describe policy for tests only. They are not trusted enforcement.

## Required Secure Service

Before enabling rewards or rankings, the backend must:

1. authenticate the user;
2. create a short-lived server session with selected question IDs and authoritative answers;
3. validate each answer, order, elapsed time, and mode on the server;
4. rate-limit session creation and answer submission;
5. reject duplicate, expired, replayed, or impossible sessions;
6. finalize once using an idempotency key;
7. enforce the daily reward cap;
8. write credits through the append-only `credit_ledger` service;
9. sanitize display names and keep profiles hidden by default;
10. log moderation and fraud signals without storing unnecessary personal data.

Recommended endpoints match `src/trivia-services.mjs`:

- `POST /trivia/sessions`
- `POST /trivia/sessions/:id/answers`
- `POST /trivia/sessions/:id/finalize`
- `GET /trivia/leaderboards?period=...`

The finalize route must require `Idempotency-Key`. A verified server response, not the browser score, determines any credit ledger entry.

## Feature Flags

The browser requires both build configuration and a runtime service declaration. Staging environment write protections still take precedence. A URL alone never enables rewards.

Do not set `secureSessions`, `creditRewards`, `leaderboards`, or `profileBadges` to `true` until the deployed service, authentication, rate limits, ledger writes, and abuse tests are verified together.
