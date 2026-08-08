# Storefront And Membership Definition Review

- Production reference: [Storefront](https://robjasper2084.github.io/Jungle-Lotto/lottominded-ultra.io/merch-store.html) and [Memberships](https://robjasper2084.github.io/Jungle-Lotto/lottominded-ultra.io/memberships.html)
- Staging URL: Local only
- Affected routes: `/merch-store.html`, `/memberships.html`
- Viewports: `1440x900`, `390x844`

## Staging Screenshots

- [Storefront desktop](store-membership-definition-assets/storefront-1440x900.png)
- [Storefront mobile](store-membership-definition-assets/storefront-390x844.png)
- [Memberships desktop](store-membership-definition-assets/memberships-1440x900.png)
- [Memberships mobile](store-membership-definition-assets/memberships-390x844.png)

## Improvements

- The Storefront now presents exactly three launch products instead of mixing concept packages, TBA pricing, and simulated preorder controls.
- Each product exposes inventory, variant, material, care, and ship-date status. Missing operational data is stated instead of invented.
- Guardian terms are consistent at `$29.95`: physical Guardian, exactly three months Ultra, 150 credits, Series 01 badge, one-time code, and no renewal.
- Free, Gold, Ultra, and Guardian now have an exact comparison matrix covering quotas, credits, storage, exports, reports, packs, beta access, physical goods, and renewal.
- The legacy account backend and Supabase webhook now agree on the Guardian term, credits, badge, and idempotent entitlement behavior.

## Visual Comparison

The v1 baseline focused on cinematic commercial gates. The updated routes retain the same Detroit-inspired black, gold, cyan, and violet system, orb navigation, Guardian artwork, music-console HUD, and cinematic product photography while moving the shopping and plan facts into clearer operational panels. Mobile layouts remain single-column with no horizontal overflow.

## Regressions And Accessibility

- No console errors, broken same-origin assets, or horizontal overflow were found in the four captures.
- Checkout remains unavailable because inventory and fulfillment are not configured. This is an intentional safety state, not a regression.
- Fixed music controls still occupy the lower viewport area as in the existing visual system; product and plan content remains reachable by scrolling.

## Recommended Corrections

- Supply verified inventory, materials, care, shipping, tax, return, confirmation, and tracking data.
- Add the final product photographs and secure fulfillment configuration before enabling ordering.
- Run authenticated Stripe test-mode Checkout for each launch SKU after operations are configured.

## Approval Status

Ready for production review as a truthful fail-closed catalog. Ordering is not approved for commerce launch and remains locked until inventory, fulfillment, tax, returns, confirmation email, and tracking are verified.
