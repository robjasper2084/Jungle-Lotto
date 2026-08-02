# Home, Storefront, And Spheres Corrections

## Review Scope

- Upgrade branch: `upgrade-redesign`
- Audited implementation commit: `03129291ff064bebee08642d5e43b57d6b0bbee9`
- Staging URL: `http://127.0.0.1:8321/`
- Production reference: `v1-final` at `975c637cea7003533cdc30aed9d96be51929bfc8`
- Routes: `/index.html#top`, `/merch-store.html`, and `/lottery-spheres.html#spheres`
- Viewports: `1440x900`, `768x1024`, and `390x844`

## Visual Comparisons

| Route | Production baseline | Staging desktop | Staging tablet | Staging mobile |
| --- | --- | --- | --- | --- |
| Home | [Desktop](../visual-baseline/v1/home--desktop.png), [Tablet](../visual-baseline/v1/home--tablet.png), [Mobile](../visual-baseline/v1/home--mobile.png) | [1440x900](signal-media-corrections-assets/home-1440x900.png) | [768x1024](signal-media-corrections-assets/home-768x1024.png) | [390x844](signal-media-corrections-assets/home-390x844.png) |
| Storefront | [Desktop](../visual-baseline/v1/merch-store--desktop.png), [Tablet](../visual-baseline/v1/merch-store--tablet.png), [Mobile](../visual-baseline/v1/merch-store--mobile.png) | [1440x900](signal-media-corrections-assets/storefront-patches-1440x900.png) | [768x1024](signal-media-corrections-assets/storefront-patches-768x1024.png) | [390x844](signal-media-corrections-assets/storefront-patches-390x844.png) |
| Spheres | [Desktop](../visual-baseline/v1/lottery-spheres-spheres--desktop.png), [Tablet](../visual-baseline/v1/lottery-spheres-spheres--tablet.png), [Mobile](../visual-baseline/v1/lottery-spheres-spheres--mobile.png) | [1440x900](signal-media-corrections-assets/spheres-1440x900.png) | [768x1024](signal-media-corrections-assets/spheres-768x1024.png) | [390x844](signal-media-corrections-assets/spheres-390x844.png) |

The Storefront evidence temporarily hides the unrelated fixed instrument console so the complete replacement product art can be inspected. The product page itself retains that console.

## Improvements

- Restored the original Home commercial overlay and its existing video while keeping playback muted until the visitor explicitly chooses sound.
- Replaced the two selected Innovation Floor hoodie listings and the selected Model Drop gallery tile with the supplied Detroit 1701 embroidered patch artwork and `$10` pricing.
- Expanded the compact Spheres console so the frequency generator presents all six presets, the level control, play control, and status copy without clipping.
- Preserved the shared black, gold, cyan, and violet visual language, spherical navigation, Detroit artwork, and Guardian identity.

## Intentional Departures

- Home now opens with the restored commercial instead of immediately exposing the hero.
- Three selected Storefront surfaces now advertise the Detroit 1701 embroidered patch rather than the previous hoodie/model-drop products.
- The Spheres fixed console is slightly taller and gives the frequency generator more horizontal space. On narrow screens the console remains horizontally scrollable and opens with the generator available in the same control deck.

## Regressions And Accessibility

- No horizontal overflow was detected at any audited viewport.
- No console errors, page errors, or broken same-origin assets were detected in the capture pass.
- The Home commercial retains keyboard-focusable close, sound, and enter controls; autoplay remains muted-first.
- The Storefront patch images include descriptive alternative text and explicit dimensions.
- No unintentionally lost feature was identified in the affected routes.

## Safety And Performance

- Staging contains `noindex,nofollow,noarchive` and the visible preview banner.
- Live payments, production account writes, real redemptions, and production analytics remain blocked.
- The supplied 7.22 MiB PNG was converted to a 126 KiB WebP for the three Storefront placements.
- No checkout, account, redemption, or production deployment behavior changed.

## Verification

- Home validation passed.
- Site validation passed for 16 HTML files.
- Focused Home, Storefront, and Spheres browser checks passed 6/6.
- Home regression checks passed 12/12 with 4 intentional viewport skips.
- Full source/staging route matrix passed 150/150.
- Staging safety checks passed 10/10 for 25 generated pages and 569 same-origin references.

## Approval Status

**Ready for next phase.** Production approval remains **Not approved** for this upgrade commit.
