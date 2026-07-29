# LottoMind Production Launch Report

## Launch Record

- Production URL: https://robjasper2084.github.io/Jungle-Lotto/lottominded-ultra.io/
- Staging URL: Local only (`http://127.0.0.1:8143/` when the staging server is running)
- Pull request: [#2 - Release: LottoMind upgraded site experience](https://github.com/robjasper2084/Jungle-Lotto/pull/2)
- Release candidate: `v2-rc3` at `fc8317ca0c3ea604ee4f64bd4767b123685e45cd`
- Production merge commit: `09f8e5d2c8bc10d0cf1af240216404c6af74c3c0`
- Production launch tag: `v2-launch3`
- Permanent pre-upgrade snapshot: `v1-final` at `975c637cea7003533cdc30aed9d96be51929bfc8`
- Merge method: GitHub pull request **Create a merge commit**
- Production authorization: exact `APPROVE PRODUCTION MERGE` supplied by the repository owner; the owner explicitly waived an outside-collaborator review

## Deployment Result

GitHub Pages workflow [run 30410927453](https://github.com/robjasper2084/Jungle-Lotto/actions/runs/30410927453) completed successfully for the production merge commit. The existing `main` deployment workflow was used without changing deployment settings.

The workflow reported two non-blocking maintenance warnings:

- The uploaded Pages artifact was `2,279,611,431` bytes, above the action's stated 1 GB allowance. This launch completed, but repository and artifact size reduction is a recommended follow-up.
- Several GitHub actions still target Node.js 20 and were forced onto Node.js 24 by the runner. Updating those action versions is a recommended workflow-maintenance follow-up.

## Live Verification

- HTTP verification: 22/22 public HTML, support, account, and game routes returned `200`.
- Browser route verification: 44/44 desktop/mobile route checks passed with no console, page, same-origin asset, overflow, noindex, staging-banner, or environment-mode failures.
- Game surfaces: 5/5 visible for GothTechnology, Jackpot Maze, OpenGW Levels, Shadow Ops, and RAYCHASE PONG.
- PWA: production manifest, icon declaration, service worker, sitemap, and bounded cache configuration are available.
- Navigation: Games, RAHBE, Storefront, and Static Wav labels are live.
- Homepage: the removed startup popup remains absent.
- Memberships: exactly one entry commercial is present and plays the intended media.
- Storefront: exactly one entry commercial is present.
- Static Wav: exactly one commercial gate is present.
- Spheres: the removed automatic Jackpot Maze popup remains absent.
- Account: Collector Access reports the signed-out state without claiming authentication.
- Checkout: production configuration reports ready, but a signed-out plan selection stops at Collector Access. No `/billing/checkout` request, Stripe request, redirect, or charge was initiated.
- Production metadata: staging `noindex,nofollow,noarchive` and the preview banner are absent.

## Visual Comparison

- Approved staging review: [`docs/staging-reviews/release-candidate-v2-rc3.md`](staging-reviews/release-candidate-v2-rc3.md)
- Production Membership desktop: [`memberships-1440x900.png`](production-launch-assets/memberships-1440x900.png)
- Production Membership mobile: [`memberships-390x844.png`](production-launch-assets/memberships-390x844.png)
- Production Static Wav desktop: [`static-wav-1440x900.png`](production-launch-assets/static-wav-1440x900.png)
- Production Static Wav mobile: [`static-wav-390x844.png`](production-launch-assets/static-wav-390x844.png)

The production captures match the approved staging layout with the expected removal of staging-only banners and noindex metadata. LottoMind's Detroit-inspired black, gold, cyan, and violet language, Guardian artwork, music-technology controls, cinematic media, arcade personality, and responsible-entertainment wording remain recognizable.

## Post-Launch Issues

No production-blocking issue was found. The Pages artifact size and action runtime warnings above remain as maintenance work. The Arcade/Features route also remains the heaviest visual route and should be the first target in a future media-optimization phase.

## Rollback

Rollback must preserve history and use a normal merge revert:

```bash
git fetch origin --tags --prune
git switch main
git pull --ff-only origin main
git revert -m 1 09f8e5d2c8bc10d0cf1af240216404c6af74c3c0
git push origin main
```

Do not reset, rebase, move tags, delete branches, or force-push. Keep `upgrade-redesign`, `v1-final`, all release-candidate and launch tags, staging reviews, and the visual baseline.
