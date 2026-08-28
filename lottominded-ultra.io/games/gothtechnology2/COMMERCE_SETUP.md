# Store conversion v2 — current local setup (2026-08-28)

## Safe defaults and one mode decision

store/commerce/mode.ts derives interest or commerce from the catalog, public Shopify configuration, launch approval, and owner facts. Default is interest. The hero, cards, product pages, drawer, provider selection, and offer schema use that decision.

Interest mode saves only variant IDs and quantities locally. Prices are recomputed from current catalog data; stored prices are not trusted. No payment, order, reservation, fake checkout confirmation, or email success is created. The action is Get Launch Alert, not a disabled checkout.

Approved commerce requires PUBLIC_COMMERCE_MODE=shopify, valid public Storefront configuration, PUBLIC_LAUNCH_APPROVED=true, complete approved product information, owner-reviewed policies/contact/regions, and a recorded checkout test. Complete store/content/launch.ts; do not insert placeholders as approved facts. npm.cmd run check:launch-readiness lists blockers. An incomplete approved build is rejected; ordinary demo builds are allowed.

Product data is a build snapshot; rebuild for changed products/handles. Runtime cart mutations, totals, repricing, availability, and checkout remain Shopify-authoritative. Checkout validates exact HTTPS hosts and rejects credentials, unexpected ports, and unapproved hosts. No real Shopify account or checkout was tested here.

Only public Storefront tokens belong in PUBLIC_SHOPIFY_STOREFRONT_TOKEN. Never use an Admin token, private Storefront token, secret app credential, or payment key. The API version currently configured by this repository is 2026-07; confirm compatibility against the merchant's approved API configuration before launch.

## Owner policy data

store/content/launch.ts holds nullable public facts and approvals. Support pages render owner policy content only when commerce and policies are approved; otherwise they retain clearly labeled drafts. A supplied public support contact can be shown while still in interest mode. Do not treat this implementation as legal review.

Product facts include physical specifications, fit, care, shipping/returns, included items, and digital contents/license/delivery. Missing details are grouped in Product Development Status. Photography approval covers the entire gallery, so do not approve a mixed unverified gallery.

## Shared subscription endpoint contract

The reusable adapter in store/state/subscription.ts is used by the footer newsletter and Launch Loadout dialog. It requires PUBLIC_NEWSLETTER_ENDPOINT (HTTPS, no URL credentials or fragment) and launchOwner.subscriptionApproved. Never include a service secret in the public URL.

After valid email and explicit consent, POST JSON with credentials omitted and redirects rejected:
- email, consent: true, version (consent schema version)
- source: pathname only, without search parameters
- productHandles and interests: handle, variantId, size, color, quantity
- optional collection and character identifiers

No browser-supplied timestamp is trusted; the receiving service must record its own timestamp and consent evidence. The request times out after 12 seconds. A successful HTTP response must return JSON with status equal to accepted or pending_confirmation; an empty 200 response is not success. Errors are honest and announced. With no approved service, no POST occurs and the form says: “Launch alerts are not connected yet. Your email was not saved or sent.”

Email is never saved to localStorage/sessionStorage. The alert dialog clears its email on close. The receiving service still needs allowed origins, server validation, consent retention, rate limiting, spam/abuse controls, confirmation, and unsubscribe. Unit tests use mocks; real delivery is not tested.

## Release boundary

No push, deployment, live payments, indexing approval, or account provisioning is part of conversion v2. The older release instructions below describe the already-published preview, not authorization to publish this branch. Review OWNER_LAUNCH_CHECKLIST.md and obtain separate release approval.

---

## Previous adapter notes (retained for history)


Default: PUBLIC_COMMERCE_MODE=demo. No payment requests are made, no order is created, and no email is collected. The catalog is expressly conceptual. Prices are demonstration values in integer minor units.

## Shopify

Use an owner-controlled Shopify store and a PUBLIC Storefront access token. Never use an Admin token, app secret, private Storefront token, or Supabase service-role key in any PUBLIC variable.

Configure PUBLIC_SHOPIFY_STORE_DOMAIN (the shop's myshopify.com domain), PUBLIC_SHOPIFY_STOREFRONT_TOKEN, and PUBLIC_SHOPIFY_API_VERSION. The implemented default API version is 2026-07. The adapter reads product/variant/collection pagination, performs Cart API mutations, surfaces user errors, and refreshes totals before checkout. It allows HTTPS checkout only on the configured shop domain, checkout.shopify.com, shop.app, or the explicit approved custom checkout domain.

Build-time reads generate product routes from the real catalog. Rebuild when products or handles change. Runtime cart mutation and checkout data remain Shopify-authoritative; product card availability is a build snapshot. Taxes, shipping and discount eligibility must be confirmed in Shopify checkout. Cart persistence stores a cart identifier, not customer or payment data.

Keep PUBLIC_LAUNCH_APPROVED=false until the owner verifies inventory, prices, variants, taxes, delivery zones, refund policy, domain, legal copy, and test-mode checkout. Never enable live payments just to test this preview. No live Shopify account or checkout was exercised in this task; adapter tests use fixtures.

## Stripe / Supabase

No Stripe or Supabase integration is provisioned. Accounts, wishlist and monetary reward features stay disabled. A future owner-approved Stripe Payment Link can be configured as a separate explicit checkout strategy; a URL is not a replacement for cart totals, fulfillment or verified reward eligibility. Do not copy secret keys into the client.

Newsletter requests go only to a configured HTTPS endpoint after explicit consent. The endpoint must implement validation, rate limiting, allowed-origin checks and confirmation appropriate to the chosen email service. Demo signup does not send or save the address.
