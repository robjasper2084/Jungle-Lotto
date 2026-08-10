# Rollback instructions

No production deployment or commit is part of this implementation.

1. Remove `src/refined-embed.mjs` and `refined-embed.css` only if retaining the standalone Trivia Vault; remove the whole game folder only for a full feature rollback.
2. In `lotto mind refined/app.js`, remove the refined module loader/mount, restore the prior `triviaGameView()`, and restore the prior single-game Arcade player.
3. Revert the trivia methods in `lottomind-account-service.js`, the news-hub trivia router/store changes, the Edge Function routes, and migration `20260809141838_secure_trivia_rewards.sql` as one security boundary.
4. Run the repository diff and confirm unrelated Arcade, account, merchandise, and app work remains intact.

## Native integration files

- `lotto mind refined/app.js`: native mount lifecycle, complete Arcade catalog, persistent player, and account-sync guard.
- `games/lottomind-trivia/src/refined-embed.mjs` and `refined-embed.css`: native game UI.
- `lottomind-account-service.js`: session, timed-answer, and claim calls.
- `news-hub/server/trivia-rewards/routes.ts` and the account store: authoritative local API and ledger.
- `supabase/functions/lottomind-api/index.ts` and the migration: hosted authoritative equivalent.
