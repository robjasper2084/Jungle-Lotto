# Help Center And RAHBEE Depth Review

- Phase: Owner-requested support-route restoration and visual-depth refinement
- Affected routes: `/help.html`, `/account.html`, `/terms.html`, `/privacy.html`
- Production reference: `v1-final` at `975c637cea7003533cdc30aed9d96be51929bfc8`
- Staging URL: Local only (`http://127.0.0.1:8143/` after the focused commit is built)
- Approval status: Ready for next phase

## Improvements

- Restored a dedicated searchable Help Center with eleven real guidance topics and canonical support links.
- Routed the shared Help utility and Account credits guidance to the new Help route.
- Added the existing Robot RAHBEE startup depth artwork behind Account, Terms, and Privacy without changing their content or account behavior.
- Preserved the shared header order, footer utilities, keyboard route search, reduced-motion support, and read-only local Account state.

## Visual Comparison

- Help is a new route and has no direct `v1-final` screenshot counterpart; its shell follows the current LottoMind platform and header treatment.
- Account changes from a mostly flat perspective floor to layered RAHBEE far, mid, emissive, and rail artwork while preserving the same hero, form, and content hierarchy.
- Terms and Privacy retain their original legal copy and compact reading panel, now presented as a cyan, violet, and gold depth HUD.
- The Detroit-inspired black, gold, cyan, violet, Guardian, arcade, and music-technology identity remains recognizable.
- Captures: `docs/staging-reviews/help-rahbee-depth/screenshots/` at 1440x900 and 390x844.

## Accessibility And Performance

- Help search announces result counts and supports local category filtering without network requests.
- Account, Terms, and Privacy have no horizontal overflow at desktop or mobile sizes.
- The depth layers use existing optimized WebP assets and become static under reduced-motion preferences.
- No payment, redemption, account-write, analytics, or production-data behavior was changed.

## Regressions And Recommendations

- No intentionally preserved feature was removed.
- No material regression was found in focused desktop/mobile browser checks.
- Keep production unchanged until the upgrade branch receives a separate controlled production approval.
