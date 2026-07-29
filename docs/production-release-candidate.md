# LottoMind Production Release Candidate

- Production URL: https://robjasper2084.github.io/Jungle-Lotto/lottominded-ultra.io/
- Current production branch head: `main` at `f6e46b49eb0fe7e02e537ed48a127226e7b3f72a`
- Permanent pre-upgrade snapshot: `v1-final` at `975c637cea7003533cdc30aed9d96be51929bfc8`
- Upgrade branch: `upgrade-redesign`
- Audited implementation baseline: `fd4cc64a85e6d0e1ae5bbd926646abe99cd90094`
- Release-candidate tag: `v2-rc3` (the tag target is the final candidate documentation commit)
- Staging URL: Local only (`http://127.0.0.1:8143/`)
- Production approval: Approved by the repository owner with the exact `APPROVE PRODUCTION MERGE` authorization; the owner explicitly waived an outside-collaborator review

## Full Route Test Summary

- Site validation: 15 HTML files passed duplicate-ID and local-asset checks.
- Source browser suite: 126 passed, 6 intentional viewport skips, 0 failed.
- Source/staging route matrix: 92 passed across 23 routes, desktop and mobile.
- Staging browser safety suite: 10 passed, 0 failed.
- Staging static artifact: 23 noindexed pages and 543 same-origin references passed.
- News account/feed suite: 20 passed; production dependency audit reports 0 vulnerabilities.
- GothTechnology: 39 unit tests and 25 browser tests passed, with 5 intentional skips.
- Shadow Ops typecheck passed.
- Release gate audit: 7 groups passed, including 12 metadata routes and 12 structured-data blocks.

## Accessibility Summary

No release-blocking automated accessibility issue remains. The audited browser coverage includes keyboard navigation, accessible commercial controls and status messages, reduced-motion behavior, mobile viewport containment, clean accessible names, and fixed-control clearance.

## Performance Summary

Recorded first-load comparisons remain Home 5.80 MiB, Memberships 2.87 MiB, Storefront 1.99 MiB, and Shadow Ops 3.70 MiB. Arcade/Features remains the heaviest visual route at approximately 6.6 MiB initially and 9.1 MiB fully loaded; its metadata-only video preload and lazy media loading keep this a warning rather than a blocker.

## SEO And PWA Summary

The release audit verified production-safe metadata on 12 sitemap routes, parsed 12 JSON-LD blocks, checked the manifest and icon, and confirmed bounded service-worker caching. Source production pages contain neither staging noindex metadata nor the preview banner. The staging build injects `noindex,nofollow,noarchive` and its visible preview banner on all 23 generated pages.

## Checkout Safety Summary

The prior authenticated Stripe Sandbox handoff was reached and cancelled before completing a charge. This audit reverified signed-in token forwarding, rejected unsafe redirects, disabled malformed plans, accurate cancelled-return wording, and staging write protections. Staging blocks live payments, production account mutations, real collectible redemptions, and production analytics.

## Backend Limitations

No isolated staging backend, remote preview provider, or dedicated Stripe test project is configured. Protected staging writes therefore remain disabled. Versioned Supabase function source was not deployed to the production-only backend.

## Known Issues And Warnings

- Staging is local-only and is available while the local server is running.
- Arcade/Features image and video weight remains an optimization opportunity.
- Local and remote `v2-rc1` annotation objects differ but resolve to the same historical commit. Neither tag was moved or deleted. `v2-rc2` remains immutable, and the mobile transition correction uses `v2-rc3`.
- Audible autoplay remains subject to browser policy; commercial controls expose an accurate muted fallback and never claim sound started when blocked.
- PR #2 is mergeable; the repository owner explicitly waived an outside-collaborator review and supplied the required production-merge authorization.

## Exact Change Areas

Relative to the current production branch, this candidate changes shared navigation and transitions; Home, Memberships, Games/Arcade, News, Events, Spheres, RAHBE, Storefront, Static Wav, app/tool, account, legal, and support surfaces; staging guards and build tooling; game runtimes and media; checkout validation; and release/test documentation. The authoritative list is:

```bash
git diff --name-status origin/main...v2-rc3
```

## Visual Comparisons

- Production baseline: [`docs/visual-baseline/v1/`](visual-baseline/v1/)
- RC3 review: [`docs/staging-reviews/release-candidate-v2-rc3.md`](staging-reviews/release-candidate-v2-rc3.md)
- RC3 Static Wav captures: [`docs/staging-reviews/release-candidate-v2-rc3-assets/`](staging-reviews/release-candidate-v2-rc3-assets/)
- RC2 full-phase captures and machine report: [`docs/staging-reviews/signal-media-corrections-assets/`](staging-reviews/signal-media-corrections-assets/)

The full RC2 pass captured 17 affected surfaces at `1440x900`, `768x1024`, and `390x844`; all 51 captures passed. RC3 additionally recaptured the affected Static Wav gate at `1440x900` and `390x844` after the mobile transition correction.

## Rollback Procedure

Keep `v1-final`, `upgrade-redesign`, and all release tags. If an eventual production merge must be rolled back, identify its merge commit and create a normal revert:

```bash
git fetch origin --tags --prune
git switch main
git pull --ff-only origin main
git revert -m 1 <PRODUCTION_MERGE_COMMIT_SHA>
git push origin main
```

Do not reset, rebase, delete tags, or force-push.

## Recommended Production Merge

Use PR #2 from `upgrade-redesign` to `main` and choose **Create a merge commit**. Do not squash or rebase. The repository owner supplied the exact production authorization and explicitly waived an outside-collaborator review.
