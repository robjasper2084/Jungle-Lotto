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
- Deployment mechanism discovered: GitHub Pages Actions from repository-root `.github/workflows/pages.yml`; pushes to `main` upload the repository root with `actions/upload-pages-artifact` and deploy with `actions/deploy-pages`. The latest verified successful production run deployed `main` commit `975c637cea7003533cdc30aed9d96be51929bfc8`.
- Staging provider: Local static server (Mode C); no remote preview provider is configured
- Staging URL: Local only (`http://127.0.0.1:8143/` while `npm.cmd run staging:serve` is running)
- Staging integrations: No isolated backend or Stripe test-mode configuration is currently configured; protected writes remain disabled
- Last completed step: Step 0B - isolated LottoMind staging preview workflow created and verified locally
- Last successful test run: `npm.cmd run staging:test` on 2026-07-20; 23 routes, 506 same-origin asset references, and 3 Playwright staging tests passed
- Production approval status: Not approved
- Rollback reference: `v1-final` at `975c637cea7003533cdc30aed9d96be51929bfc8`; after a controlled production merge, use `git revert` for rollback
- Known pre-existing repository changes: The working tree was clean when Step 0A began. Local `main` already contained commit `1fc4c95ca4d0b22ee5188d06f8ea75573c63a00a` ahead of `origin/main`; that commit was preserved as the starting point of `upgrade-redesign` and was not pushed to production.
