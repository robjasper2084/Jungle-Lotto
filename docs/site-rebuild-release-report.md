# LottoMind Site Rebuild Release Report

## Release Scope

- Production URL: https://robjasper2084.github.io/Jungle-Lotto/lottominded-ultra.io/
- Production: `main` at `09f8e5d2c8bc10d0cf1af240216404c6af74c3c0`
- Permanent rollback snapshot: `v1-final` at `975c637cea7003533cdc30aed9d96be51929bfc8`
- Upgrade branch: `upgrade-redesign`
- Current audited tree: `050ecb279ea4deafe6d75714874c34be486f304d` before the focused preflight documentation update
- Staging URL: Local only (`http://127.0.0.1:8369/`)
- Current release candidate: None; `v2-rc1`, `v2-rc2`, and `v2-rc3` are historical and remain immutable
- Production state: unchanged by this work

## Verification Summary

- 160 source browser checks passed with 8 intentional viewport skips.
- 156 source/staging route checks passed across desktop, tablet, and mobile.
- 11 staging browser safety checks passed.
- 26 generated staging pages and 591 same-origin references passed static verification.
- Seven release-audit groups passed for metadata, structured data, PWA, checkout hooks, offline account behavior, challenges, and share cards.
- 75 visual states passed across 25 routes at `1440x900`, `768x1024`, and `390x844`.

## Accessibility And UX

The mobile Help hero was tightened without removing content. At `390x844`, both Help actions remain visible and clear of the fixed Credits and Menu controls. Keyboard focus, reduced motion, overflow, console/page errors, and same-origin assets passed across the full sign-off inventory.

The site retains the Detroit-inspired black, gold, cyan, and violet system, Guardian and orb artwork, music-technology controls, arcade personality, cinematic media, and entertainment-only language.

## Presentation Media

The Home entry popup now presents the existing Storefront unboxing commercial while preserving explicit muted-first controls. Optimized presentation files reduce three video payloads by 73.4-73.5% and two large image payloads by 92.0-93.7%. Original source files remain available for future encoding work.

Current staging transfer measurements are machine-recorded in `docs/staging-reviews/release-signoff-assets/release-signoff-manifest.json`. These are directional local measurements, not a production performance budget.

## SEO, Metadata, PWA, And Safety

Metadata, JSON-LD, manifest/icon, service-worker, checkout-hook, account-offline, challenge, and share-card audits passed. The staging artifact is visibly labeled, noindexed, and fail-closed for live payments, production account writes, real redemptions, and production analytics.

## Checkout And Backend Limitations

The production billing configuration reports enabled plans, and the live Memberships UI reports that secure Stripe checkout is ready. A signed-out Gold selection correctly stops at Collector Access, and an unauthenticated checkout request returns `401`; no Stripe redirect, payment details, payment submission, or charge occurred.

The current browser session is not authenticated, and the live configuration does not expose whether Stripe is in `test` or `live` mode. The authenticated Stripe handoff and cancellation therefore remain required before a future release-candidate tag or production review. No remote preview provider, isolated staging backend, or dedicated Stripe test project is configured.

## Visual Evidence

- Baseline: [`docs/visual-baseline/v1/`](visual-baseline/v1/)
- Current review: [`docs/staging-reviews/help-media-release.md`](staging-reviews/help-media-release.md)
- Contact sheets and manifest: [`docs/staging-reviews/release-signoff-assets/`](staging-reviews/release-signoff-assets/)

## Release Recommendation

The source, route, release, and staging audits pass, and `origin/main` is synchronized into `upgrade-redesign`. The release remains blocked on an authenticated Stripe handoff and cancellation without charge. Do not create a release-candidate tag, open a production PR, or reuse or move an existing RC tag until that check is complete.

Rollback after any future approved merge uses a normal merge revert:

```bash
git revert -m 1 <PRODUCTION_MERGE_COMMIT_SHA>
git push origin main
```
