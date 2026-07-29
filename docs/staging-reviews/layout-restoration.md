# Previous Layout Restoration Review

## Scope

- Branch: `upgrade-redesign`
- Implementation commit: `afa774c3e178d24700cef57fc98f6b887e1baf19`
- Staging URL: `http://127.0.0.1:8295/` (local only)
- Production reference: `https://robjasper2084.github.io/Jungle-Lotto/lottominded-ultra.io/`
- Production was not changed.

## Routes Reviewed

- Home
- LottoMind App
- Arcade
- News
- How-to-Use / Help Center
- Account
- Memberships

Each route was captured at `1440x900`, `768x1024`, and `390x844`.

## Visual Comparison

Production baseline images are stored in `docs/visual-baseline/v1/`.
Restoration captures and the machine-readable capture report are stored in
`docs/staging-reviews/layout-restoration-assets/`.

### Improvements

- Home again uses the previous cinematic hero composition and compact action
  hierarchy instead of the Phase 1 platform-directory bands.
- Search, Credits, and Account utilities remain visible in the current shell.
- The desktop navigation order remains Home, App, Arcade, News + Events, Store,
  and Membership.
- The Account and Collector Vault footer directory remains available.
- News and Events remain grouped as one desktop navigation destination.

### Intentional Departures

- The public Studio overview and its navigation, search, sitemap, Arcade, and
  membership discovery entries are removed.
- The complete removed overview is recoverable from the Git reference documented
  in `docs/archived-pages/studio-phase1.md`.
- The underlying `lottomind-stem-studio/` implementation and assets remain saved
  in the repository for later work.
- The retained platform utilities and App, Help Center, and Account pages are
  newer than the v1 visual baseline by request.

### Regressions

- None found in the affected routes.
- No horizontal overflow, console errors, page errors, or broken same-origin
  assets were found in the 21 automated visual captures.

## Accessibility And Safety

- Reduced-motion captures completed successfully.
- Desktop and mobile route smoke tests passed.
- Staging uses `noindex,nofollow,noarchive` and displays the preview banner.
- Live payments, production account writes, real redemptions, and production
  analytics remain blocked.

## Verification

- Source browser tests: 147 passed, 7 intentional viewport skips.
- Staging safety tests: 10 passed.
- Source/staging route matrix: 96 passed.
- Release gate groups: 7 passed.
- Static staging verification: 28 pages and 616 same-origin asset references.
- Visual captures: 21 passed.

## Approval Status

Ready for next phase. Production approval remains not approved for this change.
