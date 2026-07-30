# Phase 1 Full Rollback Review

- Date: 2026-07-29
- Branch: `upgrade-redesign`
- Implementation commit: `885c4f7`
- Production reference: `origin/main` at `09f8e5d`
- Staging URL: `http://127.0.0.1:8296/`
- Primary comparison route: `/beat2lotto-plus.html#beat2lotto`
- Viewports: 1440x900, 768x1024, 390x844
- Approval status: Ready for next phase

## Scope

The complete `lottominded-ultra.io` site tree was restored to the current production tree on `origin/main`. This removes the Phase 1 platform architecture and every later partial Phase 1 restoration from the upgrade branch without resetting, rebasing, force-pushing, or changing production.

The removed Phase 1 implementation remains recoverable from the existing Git history and its staging review documents.

## Visual Comparisons

- Desktop: [staging](phase1-full-rollback-assets/beat2lotto-staging-1440x900.png) and [production](phase1-full-rollback-assets/beat2lotto-production-1440x900.png)
- Tablet: [staging](phase1-full-rollback-assets/beat2lotto-staging-768x1024.png) and [production](phase1-full-rollback-assets/beat2lotto-production-768x1024.png)
- Mobile: [staging](phase1-full-rollback-assets/beat2lotto-staging-390x844.png) and [production](phase1-full-rollback-assets/beat2lotto-production-390x844.png)
- Capture report: [JSON](phase1-full-rollback-assets/capture-report.json)

## Restored

- The full-screen Shadow Ops Canvas / Robot RAHBE Beat2Lotto+ route.
- The pre-Phase-1 cinematic navigation, page hierarchy, transitions, commercials, and route set.
- The production Home, Games, Memberships, News, Events, Spheres, Storefront, Static Wav, Prompt Lab, Stem Studio, and game-route implementations.

## Removed

- Phase 1 App, Arcade overview, Account overview, generated route manifest, command search, grouped News + Events HUD, platform footer directory, Help Center rewrite, and standalone RAHBE and Static Wave bridge routes.
- Later selective Phase 1 recovery, Games/navigation expansion, and platform HUD/depth changes.

## Regressions

- None against the selected production target.
- The staging and live Beat2Lotto+ pages share the same title, primary heading, Robot RAHBE composition, and responsive layout.
- No horizontal overflow, console errors, page errors, or broken same-origin assets appeared in the six comparison captures.

## Accessibility Findings

- Existing keyboard navigation, visible focus, commercial controls, transition fallback, reduced-motion behavior, and responsive game controls remain intact.
- The restored mobile Beat2Lotto+ route keeps controls within the viewport.

## Performance Findings

- No new JavaScript, media, dependency, or production integration was added.
- Phase 1 platform CSS, JavaScript, generated data, and additional public routes are no longer shipped by the staging artifact.

## Safety Verification

- The staging artifact has `noindex,nofollow,noarchive`.
- The staging banner remains visible.
- Live payments, production account writes, real redemptions, and production analytics remain blocked.
- Production returned HTTP 200 without noindex or preview markers.
- `main`, production deployment settings, and `v1-final` were not changed.

## Tests

- Focused RAHBE, commercial, navigation, and transition checks: 20/20 passed.
- Full browser suite: 126 passed, 6 expected viewport skips.
- Staging safety suite: 10/10 passed.
- Source/staging desktop/mobile route matrix: 92/92 passed.
- Release gate audit: 7/7 groups passed.
- Site validation: 15 HTML files passed.
- Homepage static validation: passed.
- Staging static artifact: 23 pages and 543 same-origin asset references.

## Recommended Corrections

- None required to complete the requested rollback.

## Approval Status

Ready for next phase. This rollback is pushed only to `upgrade-redesign`; it is not merged into `main` and is not deployed to production.
