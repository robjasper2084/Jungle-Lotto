# Secure Production Architecture

## Boundary

The visual LottoMind site remains a static GitHub Pages application. Supabase Auth, Postgres, Row Level Security, and Edge Functions are the authority for identity, plans, entitlements, LottoCredits, collector redemptions, orders, rewards, and downloads. Browser storage is display-only and cannot grant access or change a balance.

## Account And Billing Flow

1. The member signs in through Supabase Auth.
2. The static client sends its access token and a plan lookup key to `lottomind-api`.
3. The Edge Function verifies the member with `auth.getUser`, loads an enabled server-side catalog entry, and creates a Stripe Checkout Session.
4. Stripe hosts payment collection. No card data enters the static site.
5. `lottomind-stripe-webhook` verifies the raw request body with `STRIPE_WEBHOOK_SECRET` before writing subscriptions, orders, entitlements, or ledger entries.
6. Premium actions call `/entitlements/:code`; the Edge Function uses the service-role-only `has_active_entitlement` database function.
7. The account dashboard reads `currentPlan`, the append-only credit ledger balance, entitlements, orders, and downloads from `/account/snapshot`.
8. The billing portal is created server-side for an authenticated Stripe customer and returns a short-lived hosted URL.

## Data Model

- `profiles`: one Supabase user profile and Stripe customer reference.
- `plan_catalog`: canonical Stripe lookup keys; every seeded plan defaults to unavailable.
- `subscriptions`: Stripe, collector, or manual access periods.
- `entitlements`: server-authoritative premium capability grants.
- `credit_ledger`: append-only balance changes with unique idempotency keys.
- `collector_codes`: hashed, single-use Guardian redemption records.
- `game_reward_events`: pending, verified, or rejected reward claims.
- `orders`: verified payment outcomes.
- `downloads`: member download audit records.

The ledger balance is always the sum of `amount_delta`. Refunds create compensating entries; updates and deletes are rejected. The `credit_ledger` table is included in Supabase Realtime, with RLS limiting authenticated listeners to their own rows, so Ultra and Refined can refresh from the same authoritative balance.

## Production Enablement

1. Create matching Stripe Products and Prices in test mode first.
2. Set Edge Function secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PUBLIC_SITE_URL`, and `ALLOWED_ORIGINS`.
3. Apply migrations with the Supabase CLI and deploy both Edge Functions.
4. Insert the verified Stripe Price IDs into `plan_catalog`. Keep `available = false` until test Checkout, webhook, portal, cancellation, renewal, and idempotency checks pass.
5. Enable only the tested catalog rows. Never use test Price IDs with a live secret or live Price IDs with a test secret.
6. Add the production site and recovery URLs to Supabase Auth URL configuration.
7. Verify signed-out, expired-token, insufficient-credit, duplicate-webhook, expired-entitlement, and canceled-subscription behavior.

## Enforcement Rule

Client-side hiding is presentation only. A premium export, download, credit mutation, reward, or redemption is allowed only after the server verifies the authenticated user and entitlement. Static previews must continue to block payments, account writes, redemptions, and production analytics.
