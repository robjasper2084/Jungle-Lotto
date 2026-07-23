# LottoMind Production Release Candidate

- Production URL: https://robjasper2084.github.io/Jungle-Lotto/lottominded-ultra.io/
- Staging URL: Local only (`http://127.0.0.1:8204/` while the preview server is running)
- Production snapshot: `v1-final` at `975c637cea7003533cdc30aed9d96be51929bfc8`
- Upgrade branch: `upgrade-redesign`
- Audited upgrade baseline: `efc474291fd2f695902ea5d99b39efdca1aec221`
- Release-candidate tag: `v2-rc1`
- Release report: [`docs/site-rebuild-release-report.md`](site-rebuild-release-report.md)
- Production approval: Not merged; pull-request review and explicit production merge approval are still required

## Test Summary

- 15 HTML files passed site validation.
- 96 source browser checks passed with 6 intentional viewport skips and no failures.
- 15 staging browser checks passed with no failures.
- 92 source/staging route checks passed across desktop and mobile.
- 23 staging pages and 527 same-origin references passed static artifact verification.
- Staging noindex, banner, payment/account/redemption/analytics guards, local-only state, header consistency, commercial handoffs, news images, and game-route boots passed.

## Accessibility Summary

No release-blocking accessibility issue remains. Automated checks cover keyboard routes, accessible names and status messages, reduced motion, mobile viewport containment, focusable commercial controls, and fixed-control overlap. Phase reviews record no unresolved blocker.

## Performance Summary

Major routes show substantial first-load reductions: Home 5.80 MiB, Memberships 2.87 MiB, Storefront 1.99 MiB, and Shadow Ops 3.70 MiB in the recorded comparisons. Arcade/Features remains approximately 6.6 MiB initially and 9.1 MiB fully loaded; further image optimization is recommended.

## SEO Summary

Staging-only builds inject `noindex,nofollow,noarchive`; source production pages do not receive this injection. Canonical handling remains production-oriented. Production verification must confirm that no staging banner or noindex marker is present after an approved deployment.

## Checkout Safety Summary

The authenticated checkout handoff was verified in Stripe Sandbox and cancelled before any charge. Staging continues to reject live payment creation, production account mutations, real collectible redemption, and production analytics. No successful payment or redemption is claimed.

## Backend Limitations

There is no isolated staging backend or configured Stripe test-mode project. Protected staging writes stay disabled. Supabase function changes are versioned but were not deployed to the production-only backend during upgrade development.

## Known Issues And Warnings

- Preview hosting is local-only; no shareable remote staging URL is configured.
- Arcade/Features image weight remains an optimization opportunity.
- The repository emits a stale historical commit-graph warning during maintenance, although branch/tag ref operations succeed.
- Final PR approval, controlled merge, production deployment, and post-launch verification are intentionally outside Step 34.

## Exact Change Areas

The candidate contains 401 changed tracked files relative to production. They cover shared navigation and styling; page HTML/CSS/JavaScript; media and header artwork; Arcade manifests and built game assets; account, checkout, support, and Supabase source; staging and test tooling; and visual/review documentation. The authoritative file list is:

```bash
git diff --name-status v1-final...v2-rc1
```

## Visual Comparisons

- [`docs/visual-baseline/v1/`](visual-baseline/v1/)
- [`docs/staging-reviews/step-1-guardrails-baseline.md`](staging-reviews/step-1-guardrails-baseline.md)
- [`docs/staging-reviews/signal-media-corrections.md`](staging-reviews/signal-media-corrections.md)
- [`docs/staging-reviews/home-entry-scan-bars.md`](staging-reviews/home-entry-scan-bars.md)

## Rollback Procedure

Keep `v1-final`, `upgrade-redesign`, and all release tags. If the eventual production merge must be rolled back, identify the merge commit and create a normal revert:

```bash
git fetch origin --tags --prune
git switch main
git pull --ff-only origin main
git revert -m 1 <PRODUCTION_MERGE_COMMIT_SHA>
git push origin main
```

Do not reset, rebase, delete tags, or force-push.

## Recommended Production Merge

Open a pull request from `upgrade-redesign` to `main`, review and approve it, then use **Create a merge commit**. Do not squash or rebase. `main` remains unchanged until the separately authorized controlled-production-merge step.
