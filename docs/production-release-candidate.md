# LottoMind Production Release Candidate Status

## Current State

- Production URL: https://robjasper2084.github.io/Jungle-Lotto/lottominded-ultra.io/
- Production branch: `main` at `09f8e5d2c8bc10d0cf1af240216404c6af74c3c0`
- Permanent pre-upgrade snapshot: `v1-final` at `975c637cea7003533cdc30aed9d96be51929bfc8`
- Upgrade branch: `upgrade-redesign`
- Current audited upgrade tree: `050ecb279ea4deafe6d75714874c34be486f304d` before the focused preflight documentation update
- Staging URL: Local only (`http://127.0.0.1:8369/`)
- Active release-candidate tag for the current tree: None
- Historical immutable tags: `v2-rc1`, `v2-rc2`, and `v2-rc3`
- Production approval for the current tree: Not approved

The historical release candidate was merged previously. The current upgrade work is a later, unreleased checkpoint and must not reuse or move an existing RC tag. A future Step 34 run must create the next available annotated tag only after fresh approval and checkout verification.

## Current Verification

- Source browser suite: 160 passed, 8 intentional viewport skips, 0 failed.
- Release audit: 7/7 groups passed for metadata, structured data, PWA, checkout hooks, offline account behavior, challenges, and share cards.
- Source/staging route matrix: 156/156 passed.
- Staging browser safety: 11/11 passed, including mobile Help fixed-control clearance.
- Staging static artifact: 26 noindexed pages and 591 same-origin references passed.
- Visual sign-off: 75/75 states passed across 25 routes at `1440x900`, `768x1024`, and `390x844`.

## Accessibility Summary

The current automated evidence covers visible keyboard focus, reduced motion, responsive containment, console/page errors, broken same-origin assets, and the mobile Help action clearance. No automated blocker remains in the scoped changes. Manual assistive-technology review remains appropriate before a future production candidate.

## Performance Summary

- Membership unboxing commercial: 9,451,885 -> 2,510,553 bytes (73.4% smaller).
- Community signal commercial: 7,013,235 -> 1,864,180 bytes (73.4% smaller).
- Arcade hero film: 5,504,511 -> 1,456,846 bytes (73.5% smaller).
- Account hero artwork: 1,997,867 -> 159,488 bytes (92.0% smaller).
- Arcade marquee artwork: 3,038,065 -> 192,458 bytes (93.7% smaller).

The original source assets remain in the repository. Current route-level transfer measurements are recorded in the visual manifest and review report; no unapproved performance budget is asserted.

## SEO And Staging Safety

Source production HTML remains free of staging banners and staging noindex metadata. The isolated artifact injects `noindex,nofollow,noarchive`, displays the preview banner, and keeps live payments, production account writes, real redemptions, and production analytics disabled.

## Checkout And Backend Limitations

This task did not perform or complete a charge. Production configuration reports enabled plans, the live UI reports secure checkout ready, a signed-out Gold selection stops at Collector Access, and an unauthenticated checkout request returns `401` without a Stripe redirect. The authenticated Stripe handoff and cancellation remain incomplete because the browser is not signed in and the configuration does not expose its Stripe mode. No isolated staging backend, dedicated Stripe test project, or remote preview provider is configured, so protected staging writes remain disabled.

## Visual Evidence

- Production baseline: [`docs/visual-baseline/v1/`](visual-baseline/v1/)
- Current review: [`docs/staging-reviews/help-media-release.md`](staging-reviews/help-media-release.md)
- Current contact sheets and machine manifest: [`docs/staging-reviews/release-signoff-assets/`](staging-reviews/release-signoff-assets/)

## Rollback And Merge Boundary

Do not merge, deploy, move tags, rebase, reset, or force-push from this report. A future approved production merge must use a merge commit through the controlled workflow. Rollback uses a normal revert:

```bash
git revert -m 1 <PRODUCTION_MERGE_COMMIT_SHA>
git push origin main
```
