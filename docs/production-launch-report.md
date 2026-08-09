# LottoMind Production Launch Report

## Launch Record

- Production URL: https://robjasper2084.github.io/Jungle-Lotto/lottominded-ultra.io/
- Staging URL: Local only (`dist-staging`, verified at `http://127.0.0.1:8415/` during launch comparison)
- Pull request: [#3 - Release: LottoMind upgraded site experience](https://github.com/robjasper2084/Jungle-Lotto/pull/3)
- Release candidate: `v2-rc4` at `fa9b664d206423a9e09c55b26c3e600e681ded3c`
- Audited implementation: `0a79345cb4df241a46611e4c1350937155af8d2c`
- Production merge commit: `26df75658204442ab5b2273ae7c70f043f58796f`
- Production launch tag: `v2-launch4`
- Prior immutable launch tags: `v2-launch`, `v2-launch2`, and `v2-launch3` remain unchanged
- Permanent pre-upgrade snapshot: `v1-final` at `975c637cea7003533cdc30aed9d96be51929bfc8`
- Merge method: GitHub pull request **Create a merge commit**
- Production authorization: exact `APPROVE PRODUCTION MERGE` supplied by the repository owner on 2026-08-05

## Deployment Result

GitHub Pages workflow [run 30982175584](https://github.com/robjasper2084/Jungle-Lotto/actions/runs/30982175584) completed successfully for merge commit `26df75658204442ab5b2273ae7c70f043f58796f`. The existing `main` deployment workflow was used without changing deployment settings.

The workflow reported two maintenance warnings:

- The uploaded Pages artifact was `2,409,321,715` bytes, above the action's stated 1 GB allowance. Deployment completed, but artifact reduction remains urgent.
- GitHub forced several actions that target Node.js 20 onto Node.js 24. Workflow actions should be upgraded in a separate reviewed change.

## Pre-Merge Verification

- Full browser suite: 182 passed, 8 intentional viewport skips, 0 failed.
- Source/staging route matrix: 156/156 passed across desktop, mobile, and tablet coverage.
- Staging safety: 12/12 passed.
- Static staging: 26 noindex pages and 593 verified same-origin references.
- Site validation: 17 HTML files passed duplicate-ID and local-asset checks.
- Release audit: 7/7 groups passed for metadata, structured data, PWA, checkout hooks, account offline behavior, challenges, and share cards.
- Checkout safety: an authenticated Step 34 check opened Stripe Sandbox for the $4.99 Gold plan and returned without payment entry, submission, or charge.

## Live Verification

- HTTP/browser coverage: 45/45 desktop/mobile route visits returned `200`, including all six published game routes.
- Layout: no horizontal overflow was found in the tested desktop or mobile routes.
- Metadata: staging banners are absent. Public indexable routes do not contain `noindex`; Account, the 404 page, and the Fortune Grid beta intentionally retain private/beta noindex metadata.
- Navigation and identity: Home, Events, News, Games, Static Wav, Robot RAHBEE, Storefront, Memberships, and LottoMind App remain in the approved order and preserve the Detroit-inspired black, gold, cyan, and violet identity.
- Account: a fresh production context reports signed out and does not claim verified access.
- Checkout launch: production billing reports ready; a signed-out Gold selection opens Collector Access and does not leave the Memberships route, contact Stripe, or complete a charge.
- Product/Create: no standalone Product or Create routes are present in the approved route matrix; their functions remain represented by Storefront and the creative tools routes.

## Visual Comparison

- Approved staging review: [`docs/staging-reviews/release-candidate-v2-rc4.md`](staging-reviews/release-candidate-v2-rc4.md)
- Production Membership desktop: [`memberships-1440x900.png`](production-launch-assets/memberships-1440x900.png)
- Production Membership mobile: [`memberships-390x844.png`](production-launch-assets/memberships-390x844.png)
- Production Static Wav desktop: [`static-wav-1440x900.png`](production-launch-assets/static-wav-1440x900.png)
- Production Static Wav mobile: [`static-wav-390x844.png`](production-launch-assets/static-wav-390x844.png)

Fresh production and exact-candidate staging captures were compared at `1440x900` and `390x844`. The production view removes only the staging safety banner and guard messaging. The Guardian/orb artwork, cinematic commercial HUDs, music-technology controls, arcade personality, readable mobile composition, and responsible-entertainment wording remain recognizable.

## Post-Launch Issues

1. **Fortune Grid optional integration paths:** `/games/lottomind-313-fortune-grid/` loads its playable surface, but two optional account/rewards scripts request `/Jungle-Lotto/assets/...` instead of `/Jungle-Lotto/lottominded-ultra.io/assets/...` and return `404`. The beta remains noindex. Correct this on `upgrade-redesign` through a new tested release candidate; do not patch `main` directly.
2. **Publisher-hosted News media:** several third-party publisher images may be blocked by the publisher or browser ORB policy. LottoMind-hosted routes and same-origin News assets remain available; publisher availability is outside the deployment.
3. **Pages artifact size:** the 2.4 GB artifact exceeds the action warning threshold even though this deployment completed.

No unapproved post-merge implementation change was pushed to `main`.

## Rollback

Rollback must preserve history and revert the merge commit normally:

```bash
git fetch origin --tags --prune
git switch main
git pull --ff-only origin main
git revert -m 1 26df75658204442ab5b2273ae7c70f043f58796f
git push origin main
```

Do not reset, rebase, move tags, delete branches, or force-push. Keep `upgrade-redesign`, `v1-final`, all release-candidate and launch tags, staging reviews, and the visual baseline.
