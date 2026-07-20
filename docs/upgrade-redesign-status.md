# LottoMind Upgrade Redesign Status

- Production URL: https://robjasper2084.github.io/Jungle-Lotto/lottominded-ultra.io/
- Production branch: `main`
- Production commit SHA: `975c637cea7003533cdc30aed9d96be51929bfc8`
- Snapshot tag: `v1-final`
- Snapshot annotated tag object SHA: `9ba25352efc17d5b514e5afd59c8afde5c9d2949`
- Snapshot target commit SHA: `975c637cea7003533cdc30aed9d96be51929bfc8`
- Upgrade branch: `upgrade-redesign`
- Upgrade branch SHA at Step 0A branch creation: `1fc4c95ca4d0b22ee5188d06f8ea75573c63a00a`
- Upgrade branch SHA before Step 0B commit: `220653bbc300d0e0b236c6e834043f39fdfcd76c`
- Step 0B commit SHA: `6e58aafc4addabf5281262ec951a7d6df3dc66a0`
- Deployment mechanism discovered: GitHub Pages Actions from repository-root `.github/workflows/pages.yml`; pushes to `main` upload the repository root with `actions/upload-pages-artifact` and deploy with `actions/deploy-pages`. The latest verified successful production run deployed `main` commit `975c637cea7003533cdc30aed9d96be51929bfc8`.
- Staging provider: Local static server (Mode C); no remote preview provider is configured
- Staging URL: Local only (`http://127.0.0.1:8143/` while `npm.cmd run staging:serve` is running)
- Staging integrations: No isolated backend or Stripe test-mode configuration is currently configured; protected writes remain disabled
- Last completed step: Approved Arcade pilot merged into `upgrade-redesign` and verified independently on staging
- Step 1 commit SHA: This file is part of the Step 1 commit; use `git log -1 --format=%H -- docs/upgrade-redesign-status.md` to resolve its exact non-self-referential SHA. The completion report records it explicitly.
- Last staging review: Arcade pilot accepted after production, parent staging, and pilot comparison; review: `docs/staging-reviews/arcade-pilot.md`
- Staging review commit SHA: This file is part of the staging-review commit; the completion report records its exact SHA.
- Last successful test run: 2026-07-20 - merge commit `dd6d2a7d987cc08526cb59f38d2aac7c23819a57`; 2 focused Arcade desktop/mobile checks passed; `npm.cmd run routes:test` passed 92 source/staging checks; `npm.cmd run staging:test` verified 23 injected pages, 484 same-origin references, and 3 staging browser safety tests
- Visual baseline: Complete - 69 production route screenshots plus desktop, tablet, and mobile contact sheets under `docs/visual-baseline/v1/`
- Step 1 visual comparison: Production and staging home routes compared at 1440x900 and 390x844; staging adds only the preview and safety banners, with no redesign changes
- Known Step 1 baseline failures: Source Contact missing `assets/js/lm-support.js`; mobile Stem Studio horizontal overflow; Jackpot Maze blank production render plus missing heading and visible focus in source/staging. Details: `docs/regression-baseline.md`
- Staging review approval status: Ready for next phase
- Production approval status: Not approved
- Rollback reference: `v1-final` at `975c637cea7003533cdc30aed9d96be51929bfc8`; after a controlled production merge, use `git revert` for rollback
- Known pre-existing repository changes: The working tree was clean when Step 0A began. Local `main` already contained commit `1fc4c95ca4d0b22ee5188d06f8ea75573c63a00a` ahead of `origin/main`; that commit was preserved as the starting point of `upgrade-redesign` and was not pushed to production.

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
