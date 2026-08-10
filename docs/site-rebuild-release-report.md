# LottoMind Site Rebuild Release Report

> Release note (2026-08-10): this report records the tested `v2-rc8` candidate. The focused maintenance produces a 1,589-file, 944.2 MiB Pages artifact under the 1,200 MiB gate and omits 134 unreferenced media files totaling 400.1 MiB without modifying source media. The complete local release gate passed. Hosted staging remains unavailable and merchandise ordering remains locked pending verified commerce operations.

## Release Scope

- Production URL: https://robjasper2084.github.io/Jungle-Lotto/lottominded-ultra.io/
- Production: `main` at `441127f6d69d3021b9080f48e4246013ca674a6a`
- Permanent rollback snapshot: `v1-final` at `975c637cea7003533cdc30aed9d96be51929bfc8`
- Upgrade branch: `upgrade-redesign`
- Audited candidate: annotated tag `v2-rc8`
- Staging URL: Local only (`http://127.0.0.1:8649/` during visual verification)
- Production merge authorization: recorded after the complete candidate gate passed

## Verification Summary

- 232 source browser checks passed with 8 intentional viewport skips and 0 failures.
- 168/168 source/staging route checks passed.
- 12/12 staging browser safety checks passed.
- 28 generated staging pages and 645 same-origin references passed static verification.
- 84/84 packaged Pages route checks passed across desktop, tablet, and mobile.
- All 10 release-audit groups passed.
- 81/81 visual states passed across 27 routes at desktop, tablet, and mobile sizes, including Trivia Vault.
- Live Events media synchronization passed 24/24 repeated checks.
- News passed 24/24; Trivia passed 13/13; GothTechnology passed 43/43 unit and 27 browser checks.

## Accessibility And UX

Keyboard focus, reduced motion, responsive overflow, console/page errors, same-origin assets, modal pointer behavior, and mobile Help action clearance passed. The site retains Detroit-inspired black, gold, cyan, and violet styling, Guardian and orb artwork, music-technology controls, original arcade character, cinematic media, and entertainment-only language.

## Presentation Media And Performance

Initial Membership and Arcade media are deferred, game iframes launch lazily, Storefront media and motion are reduced, and Live Events film/audio synchronization is stable. The visual audit measured a 2.0 MiB median and 13.9 MiB maximum same-origin transfer. Static Wav and Memberships remain the heaviest routes.

Publisher-supplied News images are cached locally. The corrected final capture recorded zero external-asset warnings and zero broken same-origin assets.

## SEO, Metadata, PWA, And Safety

Metadata, JSON-LD, sitemap, canonical, manifest/icon, service-worker, checkout-hook, account-offline, challenge, and share-card audits pass. The staging artifact is visibly labeled, noindexed, and fail-closed for live payments, production account writes, real redemptions, and production analytics.

## Checkout And Backend Verification

The connected billing configuration reports Stripe `test` mode and seven configured plans. On 2026-08-05, an authenticated Collector session opened the $4.99 Gold monthly plan in Stripe Checkout with a visible `Sandbox` label. No payment information was entered, no payment was submitted, and no charge was attempted. Cancellation returned to Memberships with `Checkout was cancelled. No charge was made.`

Store ordering remains locked until inventory, shipping, tax, returns, confirmation email, and tracking are verified. No isolated staging backend or remote preview provider is configured, so protected writes remain disabled in the local staging artifact.

## Visual Evidence

- Baseline: [`visual-baseline/v1/`](visual-baseline/v1/)
- Full current sign-off: [`staging-reviews/release-signoff-assets/`](staging-reviews/release-signoff-assets/)
- Candidate review: [`staging-reviews/release-candidate-v2-rc8.md`](staging-reviews/release-candidate-v2-rc8.md)

## Release Recommendation

Create immutable tag `v2-rc8`, push the protected `upgrade-redesign` branch, merge its reviewed pull request to `main` with a merge commit, and verify the exact public Pages routes. The owner supplied the exact `APPROVE PRODUCTION MERGE` authorization after the complete candidate gate passed.

Rollback after any future approved merge uses a normal merge revert:

```bash
git revert -m 1 <PRODUCTION_MERGE_COMMIT_SHA>
git push origin main
```
