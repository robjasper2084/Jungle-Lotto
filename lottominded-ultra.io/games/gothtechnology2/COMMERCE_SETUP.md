# Commerce setup

Default: PUBLIC_COMMERCE_MODE=demo. No payment requests are made, no order is created, and no email is collected. The catalog is expressly conceptual. Prices are demonstration values in integer minor units.

## Shopify

Use an owner-controlled Shopify store and a PUBLIC Storefront access token. Never use an Admin token, app secret, private Storefront token, or Supabase service-role key in any PUBLIC variable.

Configure PUBLIC_SHOPIFY_STORE_DOMAIN (the shop's myshopify.com domain), PUBLIC_SHOPIFY_STOREFRONT_TOKEN, and PUBLIC_SHOPIFY_API_VERSION. The implemented default API version is 2026-07. The adapter reads product/variant/collection pagination, performs Cart API mutations, surfaces user errors, and refreshes totals before checkout. It allows HTTPS checkout only on the configured shop domain, checkout.shopify.com, shop.app, or the explicit approved custom checkout domain.

Build-time reads generate product routes from the real catalog. Rebuild when products or handles change. Runtime cart mutation and checkout data remain Shopify-authoritative; product card availability is a build snapshot. Taxes, shipping and discount eligibility must be confirmed in Shopify checkout. Cart persistence stores a cart identifier, not customer or payment data.

Keep PUBLIC_LAUNCH_APPROVED=false until the owner verifies inventory, prices, variants, taxes, delivery zones, refund policy, domain, legal copy, and test-mode checkout. Never enable live payments just to test this preview. No live Shopify account or checkout was exercised in this task; adapter tests use fixtures.

## Stripe / Supabase

No Stripe or Supabase integration is provisioned. Accounts, wishlist and monetary reward features stay disabled. A future owner-approved Stripe Payment Link can be configured as a separate explicit checkout strategy; a URL is not a replacement for cart totals, fulfillment or verified reward eligibility. Do not copy secret keys into the client.

Newsletter requests go only to a configured HTTPS endpoint after explicit consent. The endpoint must implement validation, rate limiting, allowed-origin checks and confirmation appropriate to the chosen email service. Demo signup does not send or save the address.
