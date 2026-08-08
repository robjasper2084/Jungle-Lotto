# Storefront Launch Readiness

The public Storefront is intentionally limited to three launch products. It does not accept orders until every operational requirement below is verified in the secure commerce backend.

## Launch Catalog

| Product | Public price | Current ordering state |
| --- | ---: | --- |
| Guardian Starter Bundle | $29.95 one time | Locked pending inventory and fulfillment verification |
| Detroit Embroidered Hoodie | $89.99 | Locked pending sizes, stock, material, care, and fulfillment data |
| Detroit 1701 Embroidered Patch | $10 | Locked pending stock, backing/thread, care, and fulfillment data |

The Guardian Starter Bundle contains one Little Man Guardian luggage charm, exactly three calendar months of Ultra, 150 LottoCredits, a Series 01 digital badge, one one-time redemption code, and no automatic renewal.

## Required Before Ordering Opens

- Record real inventory per SKU and variant in the backend.
- Publish final size, material, embroidery, care, and product-detail photography.
- Configure expected preorder ship dates and available destination countries.
- Configure shipping rates and tax calculation in Stripe Checkout.
- Publish a merchandise return/refund window and item-condition policy.
- Configure order confirmation email, carrier tracking, and support escalation.
- Verify Stripe test-mode Checkout for each SKU without completing a charge.
- Verify signed webhooks create an order and grant digital entitlements exactly once.
- Set `window.LOTTOMIND_STORE_FULFILLMENT_READY = true` only from a reviewed production configuration after all preceding checks pass.

## Safety Boundary

The browser cannot declare inventory or fulfillment ready by itself. The Storefront button remains disabled when the readiness marker is absent, even if a Stripe price exists. Staging also blocks live payments, account writes, redemptions, and production analytics.
