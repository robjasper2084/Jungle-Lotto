# LottoMind v2 Production Release Candidate

## Release Identity

- Production URL: https://robjasper2084.github.io/Jungle-Lotto/lottominded-ultra.io/
- Staging URL: Local only (`http://127.0.0.1:8617/` during final visual sign-off)
- Production branch: `main`
- Production SHA: `441127f6d69d3021b9080f48e4246013ca674a6a`
- Permanent rollback snapshot: `v1-final` at `975c637cea7003533cdc30aed9d96be51929bfc8`
- Upgrade branch: `upgrade-redesign`
- Upgrade branch SHA: the immutable target of annotated tag `v2-rc5` (`git rev-list -n 1 v2-rc5`)
- Release-candidate tag: `v2-rc5`
- Historical immutable tags: `v2-rc1`, `v2-rc2`, `v2-rc3`, and `v2-rc4`
- Step 34 approval: recorded
- Production merge approval: not recorded for this fresh candidate

`origin/main` contained two commits absent from the upgrade branch. It was merged into `upgrade-redesign` with the normal merge commit `0b478b0a7f0045b2e6279e32b35a3fddc5f873df`; no rebase, reset, force-push, or history rewrite was used. Production `main` remains unchanged by Step 34.

## Full Route Test Summary

- Full source browser suite: 232 passed, 8 intentional viewport skips, 0 failed (240 total).
- Source/staging route matrix: 168/168 passed across desktop, tablet, and mobile.
- Release audit: 7/7 groups passed for metadata, structured data, PWA, checkout hooks, offline account behavior, challenges, and share cards.
- Staging browser safety: 12/12 passed.
- Static staging artifact: 28 noindexed pages and 635 same-origin references passed.
- Visual sign-off: 78/78 route states passed across 26 routes at `1440x900`, `768x1024`, and `390x844`.
- Live Events media synchronization stress: 24/24 passed across three desktop/mobile repetitions.
- News data tests: 24/24 passed.
- Trivia tests: 13/13 passed.
- Secure backend contract: passed for eight RLS-protected tables, append-only credit ledger, authenticated API boundaries, and signed Stripe webhook handling.
- GothTechnology: 27 syntax checks, 50 assets, 39 motion/character checks, 43/43 unit tests, and 27 browser checks passed with 7 intentional skips.

## Accessibility Summary

Visible keyboard focus, reduced-motion behavior, responsive containment, console/page errors, same-origin assets, popup pointer behavior, and mobile Help fixed-control clearance passed the automated release suite. No automated accessibility blocker remains. Manual screen-reader review remains recommended before or immediately after release approval.

## Performance Summary

Initial Membership and Arcade media are deferred, embedded games launch lazily, Storefront media and motion are reduced, and off-screen media behavior is covered by the browser suite. The visual manifest measured a 2.0 MiB median same-origin transfer and a 13.9 MiB maximum; Static Wav and Memberships remain the heaviest first-view routes. These are measurements, not an invented performance guarantee.

The News static build now caches 41 publisher-supplied article images as 40 local assets totaling 9.77 MiB. Two desktop-only external publisher images were blocked by browser ORB policy and are recorded as warnings; no same-origin asset failed.

## SEO Summary

Metadata, canonical handling, JSON-LD, sitemap, manifest/icon, and PWA checks pass. Production source HTML contains neither the staging banner nor staging `noindex`. The isolated artifact injects `noindex,nofollow,noarchive` and the visible `LottoMind Upgrade Preview - Not Production` banner.

## Checkout Safety Summary

The connected billing configuration reports Stripe `test` mode with seven configured plans. On 2026-08-05, an authenticated Collector session launched the $4.99 Gold monthly plan in Stripe Checkout. The hosted Checkout was visibly labeled `Sandbox`.

No payment details were entered, no payment action was submitted, and no charge was attempted. Stripe's Back link returned to `/memberships.html?checkout=cancelled#membership-plans`, where the site reported `Checkout was cancelled. No charge was made.` Staging continues to block live payments, production account writes, real redemptions, and production analytics.

Store ordering remains fail-closed. Inventory, shipping, tax, return policy, confirmation email, and carrier tracking must be verified before merchandise checkout can be enabled.

## Backend Limitations

Supabase migrations and Edge Functions define the production authority boundaries for profiles, subscriptions, entitlements, credits, collector codes, rewards, orders, and downloads. No isolated remote staging backend or remote preview provider is configured. Local staging therefore remains fail-closed for protected writes, and game rewards remain disabled until a trusted verifier is connected.

## Known Issues

- Remote staging is unavailable; the reviewed preview is local only.
- Manual screen-reader review remains recommended.
- Static Wav and Memberships remain the heaviest first-view routes.
- Two external publisher images on the desktop News capture were blocked by browser ORB policy; local publisher-image fallbacks cover the article grid.
- Browser autoplay policy can require a user gesture before audible media starts; explicit sound controls remain available.
- Store ordering remains locked pending verified operations.

## Files And Systems Changed

The exact candidate path inventory is [`production-release-candidate-files.txt`](production-release-candidate-files.txt). It is generated from `git diff --name-status origin/main` immediately before the candidate commit.

Changed systems include shared navigation, transitions, sound controls, staging isolation, Home, Memberships, News, Live Events, Arcade, Robot RAHBEE, Storefront, Static Wav, LottoMind App, Account, Help, Services, legal and redemption routes, the secure Supabase/Stripe boundary, metadata/PWA validation, publisher-image caching, the game manifest, and the LottoMind 313 Fortune Grid route.

## Visual Comparison Links

- Permanent v1 baseline: [`visual-baseline/v1/`](visual-baseline/v1/)
- Full current sign-off: [`staging-reviews/release-signoff-assets/`](staging-reviews/release-signoff-assets/)
- Candidate review: [`staging-reviews/release-candidate-v2-rc5.md`](staging-reviews/release-candidate-v2-rc5.md)

Compared with v1, the candidate adds clearer platform relationships, account and support surfaces, the Fortune Grid route, repaired Jackpot Maze rendering, publisher-supplied News imagery, explicit membership and Storefront safety states, and richer media controls. The Detroit-inspired black, gold, cyan, and violet system, Guardian and orb artwork, music-technology controls, original arcade character, cinematic identity, and responsible-entertainment language remain recognizable on desktop, tablet, and mobile.

## Rollback Procedure

After any future approved merge, identify the merge commit and create a normal mainline revert:

```bash
git revert -m 1 <PRODUCTION_MERGE_COMMIT_SHA>
git push origin main
```

Never reset, rebase, rewrite history, force-push, move `v1-final`, or delete release branches or tags.

## Recommended Production Merge Method

Use the reviewed pull request from `upgrade-redesign` to `main` and select **Create a merge commit**. Do not squash or rebase. Main remains unchanged until the pull request is reviewed and the owner supplies the fresh exact authorization phrase `APPROVE PRODUCTION MERGE`.
