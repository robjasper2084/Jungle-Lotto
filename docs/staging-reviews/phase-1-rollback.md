# Phase 1 Rollback Review

## Scope

- Branch: `upgrade-redesign`
- Rollback commit: `1ddb460038223293ca00a02f0b8a8a2e5ca26710`
- Restored checkpoint: `320bf16dd66e6446e12434fb87f9320a717dee74`
- Staging URL: `http://127.0.0.1:8295/` (local only)
- Production was not changed.

## Result

The six-commit Phase 1 range was reverted with a normal Git revert commit.
The site content now matches the pre-Phase-1 checkpoint while preserving the
complete Phase 1 history for later inspection or selective recovery.

## Intentional Changes

- Removed the Phase 1 route manifest and generated navigation shell.
- Removed Phase 1 App, Arcade, Account, Help Center, Studio overview, RAHBE
  launcher, and Static Wave launcher pages.
- Restored the earlier `features-app.html`, `how-to-use.html`,
  `beat2lotto-plus.html`, Prompt Lab, Home, and shared navigation.
- Restored the earlier public route and sitemap set.
- Removed Phase 1-specific review images and reports.

The underlying `lottomind-stem-studio/` workstation remains available because
it predates Phase 1.

## Verification

- Site validation: 15 HTML files passed.
- Source browser suite: 126 passed with 6 intentional viewport skips.
- Staging safety: 10 passed.
- Source/staging route matrix: 92 passed.
- Release gate groups: 7 passed.
- Static staging verification: 23 pages and 543 same-origin references.
- Visual verification: 12 captures across Home, Games, Memberships, and
  How-to-Use at `1440x900`, `768x1024`, and `390x844`.
- Visual failures: none; no overflow, console errors, page errors, or broken
  same-origin assets.

## Visual Comparison

- Before: Phase 1 platform shell and generated route system.
- After: pre-Phase-1 orb navigation and cinematic page compositions.
- Baseline reference: `docs/visual-baseline/v1/`.
- Rollback captures: `docs/staging-reviews/phase-1-rollback-assets/`.

## Safety

- Staging remains `noindex`.
- Live payments, production account writes, real redemptions, and production
  analytics remain blocked.
- `main`, production deployment, and `v1-final` were not changed.

## Approval Status

Ready for next phase. Production remains unchanged and not approved.
