# LottoMind Upgrade Redesign Status

- Production URL: https://robjasper2084.github.io/Jungle-Lotto/lottominded-ultra.io/
- Production branch: `main`
- Production commit SHA: `975c637cea7003533cdc30aed9d96be51929bfc8`
- Snapshot tag: `v1-final`
- Snapshot annotated tag object SHA: `9ba25352efc17d5b514e5afd59c8afde5c9d2949`
- Snapshot target commit SHA: `975c637cea7003533cdc30aed9d96be51929bfc8`
- Upgrade branch: `upgrade-redesign`
- Current upgrade branch implementation SHA: `13cc272574436448c222decc233be4327e569902`
- Upgrade branch SHA at Step 0A branch creation: `1fc4c95ca4d0b22ee5188d06f8ea75573c63a00a`
- Upgrade branch SHA before Step 0B commit: `220653bbc300d0e0b236c6e834043f39fdfcd76c`
- Step 0B commit SHA: `6e58aafc4addabf5281262ec951a7d6df3dc66a0`
- Deployment mechanism discovered: GitHub Pages Actions from repository-root `.github/workflows/pages.yml`; pushes to `main` upload the repository root with `actions/upload-pages-artifact` and deploy with `actions/deploy-pages`. The latest verified successful production run deployed `main` commit `975c637cea7003533cdc30aed9d96be51929bfc8`.
- Staging provider: Local static server (Mode C); no remote preview provider is configured
- Staging URL: Local only (`http://127.0.0.1:8143/` while `npm.cmd run staging:serve` is running)
- Staging integrations: No isolated backend or Stripe test-mode configuration is currently configured; protected writes remain disabled
- Last completed step: Membership support-column restoration completed on `upgrade-redesign`; production deployment remains excluded
- Step 1 commit SHA: This file is part of the Step 1 commit; use `git log -1 --format=%H -- docs/upgrade-redesign-status.md` to resolve its exact non-self-referential SHA. The completion report records it explicitly.
- Last staging review: Membership plan layout passed; review: `docs/staging-reviews/membership-plan-layout.md`
- Staging review commit SHA: This file is part of the staging-review commit; the completion report records its exact SHA.
- Last successful test run: 2026-07-21 - focused source and exact-staging Memberships support-column checks passed; `npm.cmd run check:site` passed 14 HTML files; the rebuilt staging artifact passed 9 browser safety checks, 2 affected-route smoke checks, and 23-page/493-reference static verification
- Visual baseline: Complete - 69 production route screenshots plus desktop, tablet, and mobile contact sheets under `docs/visual-baseline/v1/`
- Step 1 visual comparison: Production and staging home routes compared at 1440x900 and 390x844; staging adds only the preview and safety banners, with no redesign changes
- Resolved Step 1 baseline failures: Contact support helper restored; Stem Studio tablet/mobile overflow corrected; Jackpot Maze runtime, heading, and entry focus restored; first-load outliers reduced; staging News production request removed
- Latest visual comparison: 24 affected-route staging captures plus desktop, tablet, and mobile v1/staging comparison sheets under `docs/staging-reviews/blocker-remediation-assets/`
- Latest performance comparison: Home 28.1 -> 5.80 MiB; Memberships 26.7 -> 2.87 MiB; Merch 23.1 -> 1.99 MiB; Shadow Ops 87.7 -> 3.70 MiB
- Staging review approval status: Ready for next phase
- Production approval status: Not approved; the live checkout handoff was verified safely in Stripe Sandbox and cancelled before any charge, but release-candidate review and production merge approval remain pending
- Rollback reference: `v1-final` at `975c637cea7003533cdc30aed9d96be51929bfc8`; after a controlled production merge, use `git revert` for rollback
- Known pre-existing repository changes: The working tree was clean when Step 0A began. Local `main` already contained commit `1fc4c95ca4d0b22ee5188d06f8ea75573c63a00a` ahead of `origin/main`; that commit was preserved as the starting point of `upgrade-redesign` and was not pushed to production.

## Billing Response Validation

- Frontend behavior: Billing requests now validate JSON, configuration shape, plan identifiers, and Stripe redirect hosts; stalled, malformed, rejected, and unreachable responses receive distinct accessible messages
- Checkout return behavior: A Stripe return is no longer described as payment confirmation until an active membership is verified from the account service
- Edge Function source: `supabase/functions/lottomind-api/index.ts` is now versioned in the repository with CORS-aware auth responses, JSON body validation, Stripe mode reporting, and checkout/portal URL validation
- Connected backend check: Production function version 5 currently returns `401 AUTH_REQUIRED` with the expected CORS header for an unauthenticated checkout request; no unexplained `500` billing failures appeared in the inspected 24-hour Edge Function log window
- Backend deployment: Not performed because the connected Supabase project exposes only its production `main` branch and production approval is not granted
- Validation limitation: `npm.cmd run check:site` still reports 65 missing references because this sparse checkout intentionally omits large source assets; the independent staging build and same-origin reference check passed
- Cleanup: Generated staging/test output and the Playwright browser cache were removed after validation; they are recreated by the documented build/test commands

## Sparse Checkout Validation

- Validator behavior: Local references pass when the target exists in the working tree or is an exact tracked path in the Git index
- Safety behavior: Untracked missing references still fail with the owning HTML or CSS file and missing path
- Sparse result: The former 65 repeated errors represented 41 unique Git-tracked paths omitted by sparse checkout, not missing production assets
- Staging result: Rebuilt 23 pages and verified 491 same-origin asset references after the validator repair

## Step 34 Prerequisite Remediation

- Step number: Step 34 prerequisite remediation (live checkout excluded)
- Implementation commits: `4b836da`, `69a3fdc`, `20b0db9`, `20906a7`, `a156e6a`, `d1e33ca`, `9c2b6d2`, `98a4c52`, `8fd8a99`, `32b1bbf`
- Tests: 92/92 route checks; 9/9 staging browser checks; 23-page/492-reference static verification; 46/46 Jackpot Maze tests; 24/24 Maze assets; Shadow Ops typecheck and gameplay pixel check
- Staging URL: Local only (`http://127.0.0.1:8143/`)
- Approval status: Ready for next phase; not ready for production release-candidate preparation until safe live-checkout verification is complete
- Production state: Remote `main` and `v1-final` remain at `975c637cea7003533cdc30aed9d96be51929bfc8`; the live URL returns 200 without staging markers

## Optional Arcade Pilot

- Step: Optional Arcade Pilot - isolated redesign experiment
- Pilot branch: `upgrade-redesign-arcade-pilot`
- Parent upgrade branch SHA: `b8e6c4a78b94dafae71cec538093adf40ce170f2`
- Pilot commit SHA: `84cbde5e1940aa1b1fbe3ae996c9a4de67dcd103`
- Accepted merge commit SHA: `dd6d2a7d987cc08526cb59f38d2aac7c23819a57`
- Pilot staging URL: Local only (`http://127.0.0.1:8143/features-app.html` while the staging server is running)
- Pilot remote preview: Not configured or deployed
- Pilot review: `docs/staging-reviews/arcade-pilot.md`
- Pilot tests: 2 focused desktop/mobile Arcade checks; 23-page staging static verification with 484 same-origin references; 3 staging browser safety checks; 92 source/staging route smoke checks
- Pilot merge status: Accepted into `upgrade-redesign` with an explicit `--no-ff` merge; historical pilot branch retained
- Post-merge visual verification: Passed at 1440x900 and 390x844 with all eight card images loaded, no horizontal overflow, and no console errors
- Remaining Arcade issues: None introduced by the merge; repository-wide baseline issues remain for source Contact, mobile Stem Studio overflow, and Jackpot Maze heading/focus behavior
- Pilot approval status: Approved and merged into the upgrade branch
- Production approval status: Not approved

## Membership Plan Layout Refinement

- Step number: Browser review refinement - Memberships plan hierarchy
- Commit SHA: This status file is part of the focused layout commit; use `git log -1 --format=%H -- docs/upgrade-redesign-status.md` to resolve the exact SHA
- Affected route: `/memberships.html`
- Changes: Membership Control Deck promoted to the top of main content; accessible document order synchronized; Vault Pass paired beside Ultra on desktop and stacked below it on mobile
- Tests: focused source layout 1/1; focused exact-staging layout 1/1; site validation 14/14 HTML files; staging browser safety 9/9; staging static verification 23 pages and 493 same-origin references
- Route smoke result: Memberships passed source and staging at desktop and mobile sizes; the complete matrix passed 80/92 overall and 46/46 staging checks, with 12 unrelated source sparse-asset failures recorded in the staging review
- Visual review: `docs/staging-reviews/membership-plan-layout.md` with 1440x900 and 390x844 captures
- Staging URL: Local only (`http://127.0.0.1:8143/memberships.html`)
- Approval status: Ready for next phase; production remains not approved

## Membership Support Column Restoration

- Step number: Browser review refinement - Collector and Guardian support columns
- Commit SHA: This status file is part of the focused support-column commit; use `git log -1 --format=%H -- docs/upgrade-redesign-status.md` to resolve the exact SHA
- Affected route: `/memberships.html`
- Changes: Collector Access fixed as the first support column; Little Man Guardian bundle restored to its original second column; mobile order fixed as Collector then Guardian
- Tests: focused source layout 1/1; focused exact-staging layout 1/1; affected staging route smoke 2/2; site validation 14/14 HTML files; staging browser safety 9/9; staging static verification 23 pages and 493 same-origin references
- Visual review: `docs/staging-reviews/membership-plan-layout.md` with refreshed 1440x900 and 390x844 support-column captures
- Staging URL: Local only (`http://127.0.0.1:8143/memberships.html`)
- Approval status: Ready for next phase; production remains not approved
