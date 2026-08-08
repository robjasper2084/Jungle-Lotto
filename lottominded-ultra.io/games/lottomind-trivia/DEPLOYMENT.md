# Trivia Vault Deployment

Trivia Vault follows the protected LottoMind workflow.

## Staging

```powershell
git branch --show-current
git status --short
npm.cmd run trivia:test
npm.cmd run games:validate
npm.cmd run staging:test
```

The staging artifact must contain the preview banner and `noindex,nofollow,noarchive`. Staging payments, redemptions, account writes, production analytics, Trivia rewards, and verified rankings remain disabled.

Build command: `node scripts/build-staging.mjs`

Output directory: `dist-staging`

Local preview:

```powershell
npm.cmd run staging:serve
```

## Production Gate

Do not deploy this feature branch directly. Merge it into `upgrade-redesign` only after review, rerun the complete release audit there, prepare a new release candidate, and follow the controlled production merge workflow. Never move `v1-final`, force-push, or bypass the release candidate.

Server rewards require a separate security approval and live endpoint verification. A static Trivia release is valid with rewards and leaderboards disabled.
