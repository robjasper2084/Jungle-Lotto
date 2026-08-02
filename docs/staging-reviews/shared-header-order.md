# Shared Header Order And Utility Pills

- Date: 2026-08-02
- Audited implementation: `37297acd4ddc910e5abe980f2741978e64e67194`
- Branch: `upgrade-redesign`
- Staging URL: `http://127.0.0.1:8321/`
- Production reference: `v1-final` at `975c637cea7003533cdc30aed9d96be51929bfc8`
- Approval status: Ready for next phase

## Requested Result

The shared sphere navigation now uses this order on every route:

1. Home
2. Events
3. News
4. Games
5. Static Wav
6. Robot RAHBEE
7. Storefront
8. Memberships
9. LottoMind App

Lottery Spheres remains available through page content and command search, but is no longer a top navigation tab. Search, Credits, and Account are matching cyan HUD pills.

## Visual Comparison

- Production baseline: `docs/visual-baseline/v1/home--desktop.png`
- Production mobile baseline: `docs/visual-baseline/v1/home--mobile.png`
- Staging desktop: `docs/staging-reviews/shared-header-order-assets/home-header-1440x900.png`
- Staging mobile: `docs/staging-reviews/shared-header-order-assets/home-header-390x844.png`

The circular route artwork, black shell, cyan signal glow, gold accents, and cinematic page composition remain recognizable. The intentional visual departures are the requested route order, the nine-tab rail, and the pill-shaped utilities. Desktop and mobile captures have no horizontal document overflow, console errors, or page errors.

## Verification

- Site validation: 16 HTML files passed
- Focused header tests: 4/4 passed across desktop and mobile
- Source and staging route matrix: 144/144 passed
- Staging safety: 10/10 passed
- Staging static references: 24 pages and 560 same-origin references passed
- Visual captures: 2/2 passed at `1440x900` and `390x844`
- Staging metadata: noindex and preview banner verified
- Protected staging behavior: live payments, production account writes, real redemptions, and production analytics remain blocked

No checkout, account-service, redemption, transition, page-media, or production deployment behavior changed.
