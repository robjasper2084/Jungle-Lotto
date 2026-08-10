# Trivia Vault security notes

## Current trust boundary

All public-bank modes provide non-monetary score, local badge progress, and local-only boards. Authenticated Daily Vault rewards use the protected account service and `/trivia/sessions` contract. The browser cannot choose eligible questions, determine correctness, set an award, supply account identity, or mutate the wallet.

Public static question shards necessarily include correct indexes, so those questions are never wallet-eligible. The server sends a separate Daily challenge without correct indexes and reveals the correct index only after an accepted answer.

## Data handling

- No private key, service-role key, or API secret is present in the app route.
- Analytics includes only mode, category, coarse score, and duration buckets.
- Selected choices and question answers are not sent to analytics.
- Local boards are device-only, hide identity, and contain no invented players.
- Imported authoring files are validated before joining the local draft.

## Authoritative Daily reward rules

The server enforces authenticated ownership, the approved build ID, ordered answers, four-choice bounds (including `-1` for timeout), 0-60 second answer timing, 30-minute expiry, one claim per account/challenge, and idempotency. It calculates 5 completion credits, +5 at 80% accuracy, and +10 for a perfect run, capped at 20. The local server and Supabase migration implement the same formula.

Remote leaderboards and profile badge sync remain disabled.
