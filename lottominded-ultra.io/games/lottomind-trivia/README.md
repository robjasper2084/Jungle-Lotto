# LottoMind Trivia Vault

LottoMind Trivia Vault is a browser trivia experience inside LottoMind Arcade. It keeps LottoMind's black, gold, cyan, and violet visual language while presenting reviewed knowledge questions through a compact game-show HUD.

## Modes

- **Quick Play:** 10 mixed questions, 15 seconds each, with a difficult Jackpot Round after eight correct answers.
- **Daily Vault:** five deterministic questions selected from the UTC date. This static build records practice locally and issues no LottoCredits.
- **Survival:** three lives. Questions begin easy, move to medium after five answers, and move to hard after ten.
- **Category Run:** 10 questions from one of seven reviewed categories.

## Question Bank

The public bank contains 154 active, approved questions, 22 in each category. Each record carries a stable ID, category, difficulty, four choices, answer index, explanation, source, review state, version, editor, and edit timestamp.

Only records with `active: true` and `reviewStatus: "approved"` are eligible for play. See [QUESTION-AUTHORING.md](./QUESTION-AUTHORING.md) for the local editorial workflow.

## Local Development

From `lottominded-ultra.io`:

```powershell
npm.cmd run trivia:test
npm.cmd run games:validate
npm.cmd test -- --grep "LottoMind Trivia Vault"
node scripts/serve-site.mjs . 8594
```

Open `http://127.0.0.1:8594/games/lottomind-trivia/`.

## Data Boundaries

- Guest scores, badges, and records use browser local storage only.
- Guest data is private by default and is not presented as verified account data.
- Static play never updates LottoCredits.
- Public leaderboards remain empty when the secure Trivia service is unavailable.
- No sample players, ranks, wins, or community activity are fabricated.

## Main Files

- `index.html`: game screens and accessible dialogs.
- `styles.css`: responsive HUD, mobile layout, focus, and reduced-motion styles.
- `src/app.mjs`: browser interaction loop.
- `src/trivia-engine.mjs`: deterministic selection and scoring.
- `src/questions.mjs`: reviewed production question bank.
- `src/trivia-services.mjs`: disabled-by-default secure service adapter and local guest storage.
- `src/trivia-security.mjs`: reward policy helpers for server tests; not a client authority.
- `tests/`: engine, schema, reward-boundary, and import tests.

## Responsible Play

Trivia and number themes are for entertainment and educational purposes only. They do not predict lottery results, improve odds, issue cash value, or promise prizes.
