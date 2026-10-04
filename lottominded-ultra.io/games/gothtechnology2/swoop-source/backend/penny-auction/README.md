# Penny Exchange backend

Status: working local prelaunch service, persistent SQLite database, all 19 existing GothTechnology catalog items. No real products or money are awarded in the explicitly labeled test mode. The service is not deployed to a public host. Production launch remains subject to repository approval.

Run with Node 24.16 or newer:

```powershell
node backend/penny-auction/server.mjs
node --test backend/penny-auction/engine.test.mjs
```

The shared 4180/4181 preview forwards `/__penny/` to the loopback backend on 4182. The database defaults to `backend/penny-auction/data/auctions.sqlite`, excluded from Git. Back it up through SQLite's backup facilities before production maintenance. Run one persistent Node process with one persistent volume; this database cannot be hosted on GitHub Pages or an ephemeral Edge Function. Host the API over HTTPS with a reverse proxy and rate limits; set a process restart policy. Keep the API, database, adapter secrets and operator console out of the static web root.

## What works

- Catalog imports all existing product handles, names, artwork, concept flags and reference prices. This does not manufacture inventory or overwrite the storefront's prices.
- Verified Supabase identities are resolved server-side with `/auth/v1/user`. Anonymous users cannot bid on production lots. Auction wallets and orders are separate from existing LottoMind wallets, rewards, memberships and payments.
- Server clock, atomic `BEGIN IMMEDIATE` bids, one-cent increments, credit ledger, request idempotency, no self-outbidding, durable history, timer extension, scheduled finalization and one winner/order per auction.
- Stock is reserved when publishing a verified production lot. No-bid lots release stock. Only paid orders can be marked shipped.
- Server-generated purchase quotes and signed, replay-safe payment callbacks. Test sessions cannot purchase real bid packs or enter production lots.
- Preview test sessions only work on loopback and allowed local origins; test wallets never share the live wallet namespace. No bot bids or invented shoppers.

## Production configuration and unresolved inputs

`SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` use the existing approved LottoMind project. No new Supabase schema, auth settings or account contracts were applied. Use the public key on the server to validate the bearer token; do not put a service-role key in the frontend.

Confirm SKU, size/color variant, actual stock quantity, approved sale price, product legality, shipping regions, shipping charge, return terms and fulfillment for each lot. Existing images include concept artwork. Some store entries are digital products, artwork, fragrance or accessory concepts; each needs its own verified fulfillment and product eligibility before it is published. Inventory is currently zero and unverified for every item.

Choose the bid model. Paid bids are non-refundable spent credits, whether the bidder wins or loses. The prepared offer is 10 bids for $6, with a 60-cent per-bid cost and a 1-cent auction increment; these are **proposed settings, not an approved live offer**. Free-bid auctions are supported too. Paid-bid auctions require an acquiring/payment provider that explicitly accepts bidding-fee auctions. Stripe prohibits them. Confirm the operator's required rules and jurisdiction eligibility before setting `policy_ready`.

Configure `AUCTION_ALLOWED_ORIGINS` as a comma-separated list of exact HTTPS site origins, `AUCTION_CHECKOUT_ADAPTER_URL`, `AUCTION_ADAPTER_SECRET`, and `AUCTION_WEBHOOK_SECRET` as server environment settings. The adapter is an integration contract, **not an installed/approved payment processor**. Implement it against the chosen provider's official API only after the merchant has been accepted. Do not disguise paid-bid payments as ordinary merchandise.

The adapter receives a server purchase ID, subtotal, currency and purchase kind with a server bearer secret and Idempotency-Key. It must collect the delivery/billing details, calculate sales tax and show the total, then return an HTTPS `checkoutUrl`, `totalAmountCents`, `currency: "USD"`, `taxCalculated: true`. The server stores this total before accepting payment. The provider adapter must verify the provider's native signature and exact captured payment status before relaying:

```json
{"type":"payment.succeeded","eventId":"provider event ID","purchaseId":"server purchase UUID","amountCents":600,"currency":"USD"}
```

Sign the raw callback body with HMAC-SHA256 over `<13-digit timestamp>.<raw body>`. Send `x-auction-timestamp` and `x-auction-signature: sha256=<hex>` to `/api/payments/webhook`. Callbacks older than five minutes or with mismatched purchase totals are rejected; duplicate events do not grant extra credits. Add the approved provider's refund/dispute workflow and reconciliation before accepting payments; that provider-specific work is still pending.

Operator tools are local CLI only (`manage.mjs`), not public endpoints. Verify inventory with `inventory <product handle> <JSON stock,retailCents,shippingCents>`, record the named accepted processor and policy approval using `launch-approval`, and then set `AUCTION_LIVE_ENABLED=true` to enable production (which disables local test sessions). Publish only eligible, verified product lots. Set `exports/polish/penny-service.json` to the deployed API's HTTPS base URL. None of these production switches have been enabled.

## Research references

- Retail fixture ideas: https://www.nintendo.com/us/retail-locations/san-francisco/ (glass displays, demo kiosks, product rails; no reference photo copied).
- Mechanics: https://www.dealdash.com/client/help/auction (paid bid credits, one-cent price increases, late-bid clock reset).
- Consumer cost disclosure: https://www.ftc.gov/news-events/news/press-releases/2011/08/ftc-cautions-consumers-pitfalls-penny-auctions
- Processor restriction: https://stripe.com/us/legal/restricted-businesses (bidding-fee auctions prohibited).
