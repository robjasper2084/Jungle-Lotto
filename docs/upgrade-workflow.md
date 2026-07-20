# LottoMind Upgrade Workflow

## Protected Production

`main` remains the protected production branch. Upgrade implementation commits must never be made or pushed directly to `main`. Production changes require explicit approval and a controlled merge from `upgrade-redesign`.

The annotated `v1-final` tag permanently identifies the final production snapshot from before the redesign. It must never be moved, replaced, or deleted.

## Upgrade Development

All redesign and upgrade implementation work belongs on `upgrade-redesign`. Each approved step must be narrowly scoped, tested, committed once its tests pass, and pushed to that branch when repository authentication is available.

Existing user work and unrelated changes must be preserved. Do not reset, clean, automatically stash, rewrite history, force-push, or mix unrelated files into upgrade commits.

## Independent Staging

Staging must be built and tested independently from production. The production URL is a read-only visual and functional reference during development.

Staging must use `noindex` and must not initiate live charges, real redemptions, production analytics, or unintended production-data mutations. Use Stripe test mode and an isolated test backend when available. Otherwise, disable write actions and label them clearly.

Major checkpoints require desktop and mobile comparisons between production and staging while preserving LottoMind's Detroit-inspired black, gold, cyan, and violet music-technology, Guardian, arcade, and cinematic identity.

## Production And Rollback

Production changes only through the final controlled-merge workflow after explicit production approval. Do not merge `upgrade-redesign` into `main` during implementation steps.

Rollback uses `git revert` so production history remains intact and auditable. Never use reset, force-push, tag movement, branch deletion, or history rewriting as a rollback mechanism. The permanent pre-upgrade reference is `v1-final`.
