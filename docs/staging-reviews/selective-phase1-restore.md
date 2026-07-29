# Selective Phase 1 Platform Restore

## Scope

- Branch: `upgrade-redesign`
- Implementation commit: `403f2e5c9e8dc1af752060d409d874747fbf378b`
- Staging URL: `http://127.0.0.1:8295/` (local only)
- Production was not changed.

## Restored

- Search command palette
- Account page and signed-out Collector Access state
- Manifest-generated desktop and mobile navigation
- LottoMind App overview at `features.html`
- Arcade overview at `arcade.html`
- Searchable Help Center at `how-to-use.html`
- Grouped News + Events navigation

## Preserved Design Decisions

- Home retains the previous cinematic composition rather than the Phase 1
  platform-directory bands.
- Navigation order remains Home, App, Arcade, News + Events, Store, Membership.
- `studio.html` remains removed from the public site, navigation, search,
  sitemap, Arcade, and Membership discovery.
- The removed Studio overview source and restoration command remain documented
  in `docs/archived-pages/studio-phase1.md`.
- The underlying `lottomind-stem-studio/` implementation and assets remain
  preserved for later work.

## Verification

- Site validation: 20 HTML files passed.
- Source browser suite: 147 passed with 7 intentional viewport skips.
- Staging safety: 10 passed.
- Source/staging route matrix: 96 passed.
- Release gate groups: 7 passed.
- Static staging verification: 28 pages and 616 same-origin references.
- Visual verification: 21 captures across seven affected routes at `1440x900`,
  `768x1024`, and `390x844`.
- Visual failures: none; no horizontal overflow, console errors, page errors,
  or broken same-origin assets.

## Comparison

- Before: pre-Phase-1 site without the requested platform utilities.
- After: previous cinematic layouts with the requested platform utilities and
  overview pages restored.
- Captures: `docs/staging-reviews/selective-phase1-restore-assets/`.
- Baseline: `docs/visual-baseline/v1/`.

## Safety

- Staging remains `noindex`.
- Live payments, production account writes, real redemptions, and production
  analytics remain blocked.
- `main`, production deployment, and `v1-final` were not changed.

## Approval Status

Ready for next phase. Production remains unchanged and not approved.
