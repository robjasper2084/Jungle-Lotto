# Storefront Bundle Packages Review

- Phase: Storefront Guardian bundle packages
- Branch: `upgrade-redesign`
- Implementation commit: `c1d259828011af1176e606bbe1f79ed3eadb3cc9`
- Production reference: https://robjasper2084.github.io/Jungle-Lotto/lottominded-ultra.io/merch-store.html
- Staging URL: http://127.0.0.1:8143/merch-store.html#drop
- Approval status: Ready for next phase

## Visual Comparison

- Production baseline: [Storefront desktop commercial](../visual-baseline/v1/merch-store--desktop.png)
- Staging desktop: [Storefront bundles at 1440x900](storefront-bundles-assets/storefront-bundles-1440x900.png)
- Staging mobile: [Storefront bundles at 390x844](storefront-bundles-assets/storefront-bundles-390x844.png)

The existing Storefront commercial remains unchanged. After the commercial closes, staging now places two bundle previews ahead of the individual product rail. The supplied retail artwork is presented inside the existing black, cyan, gold, and violet HUD language.

## Improvements

- Added Guardian Hoodie Package and Detroit Carry Package previews using the two supplied images.
- Each card lists only the concept contents visible in its artwork.
- Pricing, sizing, availability, and final contents are explicitly marked as unconfirmed.
- Wishlist saving remains local to the device; neither bundle exposes checkout or claims a submitted preorder.
- Desktop uses a balanced two-column bundle grid; mobile stacks the packages without horizontal overflow.

## Accessibility

- Both bundle images have specific alternative text.
- Package contents use semantic lists.
- Wishlist controls expose accessible names and pressed state.
- Focus and local wishlist behavior passed on desktop and mobile.

## Performance

- The two supplied lazy-loaded PNG files total approximately 4.15 MiB.
- They are not requested until the bundle section approaches the viewport.
- Future delivery should convert the approved source artwork to optimized WebP or AVIF without changing the composition.

## Verification

- Focused Storefront interaction: 2/2 passed.
- Affected source/staging route smoke subset: 4/4 passed.
- Full source/staging route matrix before the focused commit: 92/92 passed.
- Staging safety suite: 10/10 passed.
- Static staging verification: 23 pages and 544 same-origin asset references.
- Visual capture: 2/2 passed with loaded images, no horizontal overflow, no console errors, staging banner present, and `noindex,nofollow,noarchive`.

## Intentional Departure

The v1 Storefront did not include bundle-package cards. This phase adds a preview-only merchandise layer while retaining the original commercial, Guardian identity, Detroit-inspired typography, and protected commerce behavior.

