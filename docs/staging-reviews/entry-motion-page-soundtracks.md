# Entry Motion And Page Soundtracks Review

## Scope

- Routes: `/`, `/memberships.html`, `/news/`
- Viewports: `1440x900`, `768x1024`, and `390x844`
- Staging URL: Local only (`http://127.0.0.1:8573/` during final verification)
- Production reference: `v1-final` at `975c637cea7003533cdc30aed9d96be51929bfc8`

## Changes Reviewed

- Home opens directly on the product value proposition. The story commercial is inline and user-triggered, and the game panel no longer expands automatically.
- Home uses `lottomind-home-theme-untitled-12.mp3`.
- Memberships uses `lottomind-membership-theme-untitled-14.mp3`.
- News uses `lottomind-news-theme-instrumental.mp3`.
- Each route attempts playback on entry and keeps an accessible Play/Pause control available. Browser autoplay policy may still require the visitor's first gesture before audible playback can begin.
- Dismissed story state persists for 30 days, Reduce Motion is globally available, off-screen media and animated surfaces pause, and Magic 8 collapses to a compact mobile orb.

## Visual Comparison

- Production baseline: [`../../visual-baseline/v1/`](../../visual-baseline/v1/)
- Staging desktop: [`release-signoff-assets/desktop-contact-sheet.png`](release-signoff-assets/desktop-contact-sheet.png)
- Staging tablet: [`release-signoff-assets/tablet-contact-sheet.png`](release-signoff-assets/tablet-contact-sheet.png)
- Staging mobile: [`release-signoff-assets/mobile-contact-sheet.png`](release-signoff-assets/mobile-contact-sheet.png)

The black, gold, cyan, and violet color language, Detroit-inspired artwork, Guardian identity, orb navigation, music-technology personality, and entertainment-only wording remain recognizable. The intentional departures are the direct-entry Home composition and the visible soundtrack controls. No overlap or horizontal overflow was observed.

## Verification

- Home validation: passed, 20 IDs and 85 references
- Site validation: passed, 17 HTML files
- Focused soundtrack/media browser checks: 8/8
- Source and staging route matrix: 162/162
- Release audit: 7/7 groups
- Staging build: 27 pages and 616 same-origin references
- Staging safety: 12/12
- Visual sign-off: 78/78 states across 26 routes
- External warning: three third-party News publisher images were unavailable during capture; same-origin assets and application scripts had no failures

## Safety

Staging remains noindex and visibly labeled. Live payments, production account writes, real redemptions, and production analytics remain disabled. No isolated test backend or payment integration was enabled by this change.

## Approval Status

Ready for next phase. Production remains unchanged and this review does not authorize a production deployment.
