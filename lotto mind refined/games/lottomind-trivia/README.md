# LottoMind Trivia Vault

Trivia Vault is a dependency-free game engine mounted directly inside the LottoMind Refined `/trivia-play` route. It uses semantic DOM controls so the four answer choices, timer, feedback, dialogs, and results remain accessible to keyboard and assistive-technology users. The standalone folder route remains an optional development preview of the same question bank.

## Run locally

Serve the repository root over HTTP, then open:

`/lotto%20mind%20refined/trivia-play`

Optional standalone preview:

`/lotto%20mind%20refined/games/lottomind-trivia/`

## Commands

From this folder:

```powershell
npm.cmd run preview
npm.cmd run build
npm.cmd test
npm.cmd run lint
npm.cmd run typecheck
```

The build regenerates seven category shards from the reviewed editorial source and validates hashes, schemas, counts, answer-position balance, required files, and the absence of client wallet writes.

## Runtime structure

- `src/config.mjs`: scoring, timers, modes, storage keys, and feature flags.
- `src/engine.mjs`: pure scoring, timer, daily selection, results, and reward-contract helpers.
- `src/question-schema.mjs`: production eligibility and import validation.
- `src/services.mjs`: lazy question loading, guest progress, privacy-safe analytics, and local boards.
- `src/app.mjs`: standalone development preview.
- `src/refined-embed.mjs`: native Refined mount, secure Daily adapter, lifecycle cleanup, and route controls.
- `refined-embed.css`: responsive app-scoped HUD styles.
- `data/categories/`: seven independently loaded public question shards.
- `admin/`: local authoring/import workflow, unlinked from player navigation.

## Modes

- Quick Play: 10 questions, 15 seconds each.
- Daily Vault: five deterministic score-only questions for guests, or five server-selected questions for authenticated verified sessions.
- Survival: three lives, with difficulty rising after five and ten correct answers.
- Category Run: ten questions from one of seven lanes.
- Jackpot Round: one hard bonus question offered after at least eight Quick answers are correct.

## Persistence and privacy

Guest score, settings, badge progress, and genuine local leaderboard entries are stored under `lottomind.trivia-vault.*` keys. No email, answer text, wallet detail, or authoritative credit value is stored. The local boards never invent opponents or global rank.

## Credit status

The public question bank remains score-only. The native embed can request an authenticated Daily session through `LottoMindAccountService`, submit each answer in sequence, and claim only the amount returned by the authoritative service. The service grants 5 completion credits, another 5 at 80% accuracy, and another 10 for a perfect run, capped at 20 once per UTC challenge. The browser never calls the legacy `setCredits` helper and never calculates or stores wallet value.
