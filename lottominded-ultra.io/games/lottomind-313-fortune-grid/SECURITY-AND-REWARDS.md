# Security and Rewards

Detroit Dollars, Legacy Points, and Focus Tokens are match-local resources. LottoMind Credits remain in the existing authoritative account ledger.

The browser can only construct a claim proposal containing authenticated user ID, match ID, ruleset version, deterministic seed identifier, SHA-256 action-log hash, completion time, mode, final score, reward type, and stable idempotency key. `submitRewardClaim` refuses to run without a configured secure endpoint. Static Beta has no endpoint and issues no credits.

The server remains responsible for authentication, match/ruleset validation, plausible duration, duplicate protection, daily caps, score constraints, and event-log integrity. A service-role key must never enter frontend code. Approved ledger mutations must fan out through the existing account event/BroadcastChannel or Supabase Realtime contract so Refined and Ultra refresh together.

Guests play and save locally but cannot receive account credits. Saved-number export also refuses when unauthenticated or when the shared Wallet connector is absent. Local storage is never treated as authoritative account balance.
