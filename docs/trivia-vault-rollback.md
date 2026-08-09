# LottoMind Trivia Vault Rollback

Trivia Vault is isolated behind one manifest record and one game directory.

## Preferred Rollback

If the feature was accepted through a merge commit, revert that merge with a normal commit:

```powershell
git revert -m 1 <TRIVIA_MERGE_COMMIT_SHA>
```

Do not reset, force-push, delete tags, or rewrite history.

## Scoped Pre-Merge Removal

Before a merge, remove the appended `lottomind-trivia-vault` record from `games/games-manifest.json`, rerun `npm.cmd run games:sync`, remove the Trivia sitemap URL, and remove these feature-only files:

- `lottominded-ultra.io/games/lottomind-trivia/`
- `lottominded-ultra.io/scripts/manage-trivia-questions.mjs`
- `lottominded-ultra.io/tests/trivia-vault.spec.cjs`
- `lottominded-ultra.io/docs/staging-reviews/trivia-vault.md`

Then remove the Trivia scripts from `package.json` and rerun manifest, route, and staging tests.

The existing Arcade cards must remain in their original order. Trivia is appended and can be removed without modifying the other records.

## Data Impact

The current static implementation has no production Trivia tables, rewards, rankings, or account writes to roll back. Guest records remain only in each user's browser storage.
