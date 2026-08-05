# LottoMind v2 Production Release Candidate

## Release Identity

- Production URL: https://robjasper2084.github.io/Jungle-Lotto/lottominded-ultra.io/
- Staging URL: Local only (`http://127.0.0.1:8381/` during the latest verified run)
- Production branch: `main`
- Production SHA: `09f8e5d2c8bc10d0cf1af240216404c6af74c3c0`
- Permanent rollback snapshot: `v1-final` at `975c637cea7003533cdc30aed9d96be51929bfc8`
- Upgrade branch: `upgrade-redesign`
- Audited implementation SHA: `0a79345cb4df241a46611e4c1350937155af8d2c`
- Release-candidate tag: `v2-rc4` (annotated; resolve its exact target with `git rev-list -n 1 v2-rc4`)
- Historical immutable tags: `v2-rc1`, `v2-rc2`, and `v2-rc3`
- Production approval: Not approved

`origin/main` contains no commits absent from the upgrade branch. The current divergence before this documentation commit is `0 65` for `origin/main...upgrade-redesign`, so no synchronization merge is required. The required `git fetch origin --tags --prune` refused to clobber the known local `v2-rc1` tag object; branch refs were refreshed separately and both local and remote tags were left unchanged.

## Full Route Test Summary

- Source browser suite: 182 passed, 8 intentional viewport skips, 0 failed (190 total).
- Source/staging route matrix: 156/156 passed.
- Release audit: 7/7 groups passed for metadata, structured data, PWA, checkout hooks, offline account behavior, challenges, and share cards.
- Staging browser safety: 12/12 passed.
- Static staging artifact: 26 noindexed pages and 593 same-origin references passed.
- Visual sign-off: 78/78 route states passed across 26 routes at `1440x900`, `768x1024`, and `390x844`.

## Accessibility Summary

Visible keyboard focus, reduced-motion behavior, responsive containment, console/page errors, same-origin assets, popup pointer behavior, and mobile Help fixed-control clearance passed the automated release suite. No automated accessibility blocker remains. Manual screen-reader review remains recommended as a production-review activity rather than an unresolved release failure.

## Performance Summary

- Membership unboxing commercial: 73.4% smaller optimized presentation asset.
- Community signal commercial: 73.4% smaller optimized presentation asset.
- Arcade hero film: 73.5% smaller optimized presentation asset.
- Account hero artwork: 92.0% smaller optimized presentation asset.
- Arcade marquee artwork: 93.7% smaller optimized presentation asset.
- Membership and Arcade hero media are deferred; embedded games launch lazily; Storefront media and motion were reduced; the mobile Live Events player was repaired.

The original source assets remain available. Measurements are recorded evidence, not an unapproved performance budget.

## SEO Summary

Metadata, canonical handling, JSON-LD, sitemap, manifest/icon, and PWA checks pass. Production source HTML contains neither the staging banner nor staging `noindex`. The isolated artifact injects `noindex,nofollow,noarchive` and the visible `LottoMind Upgrade Preview - Not Production` banner.

## Checkout Safety Summary

The connected billing configuration reports Stripe `test` mode with seven configured plans. On 2026-08-05, an authenticated Collector session launched the $4.99 Gold monthly plan in Stripe Checkout. The hosted Checkout was visibly labeled `Sandbox`.

No payment details were entered, no payment action was submitted, and no charge was attempted. Stripe's Back link returned to `/memberships.html?checkout=cancelled#membership-plans`, where the site reported `Checkout was cancelled. No charge was made.` Staging continues to block live payments, production account writes, real redemptions, and production analytics.

## Backend Limitations

The connected Supabase `lottomind-api` Edge Function is active and the production account service supports Collector authentication, recovery, LottoCredits, and test-mode checkout creation. No isolated staging backend, dedicated remote preview project, or remote staging URL is configured. Local staging therefore remains fail-closed for protected writes.

## Known Issues

- Remote staging is unavailable; the reviewed preview is local only.
- Manual screen-reader review is still recommended.
- The local and remote annotated objects for historical `v2-rc1` differ but peel to the same historical commit; neither tag was moved or deleted.
- Browser autoplay policy can still require a user gesture before audible media starts; the UI exposes explicit sound controls.

## Files And Systems Changed

The audited implementation changes 402 files relative to production: 13,350 insertions and 656 deletions before this release-documentation commit. The exact candidate path inventory is [`production-release-candidate-files.txt`](production-release-candidate-files.txt).

Changed systems include the shared navigation and support utilities; Home, Memberships, News, Events, Games, Robot RAHBEE, Storefront, Static Wav, Account, Help, legal, redemption, and LottoMind App surfaces; Collector authentication and recovery; Stripe test Checkout handoff; Supabase API handlers; staging isolation; metadata/PWA/route validation; optimized media; and the LottoMind 313 Fortune Grid arcade route.

## Visual Comparison Links

- Permanent v1 baseline: [`visual-baseline/v1/`](visual-baseline/v1/)
- Full current sign-off: [`staging-reviews/release-signoff-assets/`](staging-reviews/release-signoff-assets/)
- Checkout remediation: [`staging-reviews/release-blocker-remediation.md`](staging-reviews/release-blocker-remediation.md)
- Step 34 preflight: [`staging-reviews/step34-preflight-refresh.md`](staging-reviews/step34-preflight-refresh.md)
- Latest Home and Collector Access evidence is preserved outside the worktree at `C:\Users\digit\Documents\phone\_jungle_lotto_release_candidate_artifacts\v2-rc4-0a79345`.

The latest Home change intentionally presents the existing commercial in a clearer futuristic HUD and makes the wordmark panel opaque enough to prevent background-letter bleed. The release-gate correction changes popup timing and Collector email focus without changing the reviewed layout. Black, gold, cyan, violet, Guardian, arcade, music-technology, and cinematic identity remain recognizable on desktop and mobile.

## Rollback Procedure

After any future approved merge, identify the merge commit and create a normal mainline revert:

```bash
git revert -m 1 <PRODUCTION_MERGE_COMMIT_SHA>
git push origin main
```

Never reset, rebase, rewrite history, force-push, move `v1-final`, or delete release branches/tags.

## Recommended Production Merge Method

Use the reviewed pull request from `upgrade-redesign` to `main` and select **Create a merge commit**. Do not squash or rebase. Main remains unchanged until the pull request is reviewed and the owner supplies the fresh exact authorization phrase `APPROVE PRODUCTION MERGE`.
