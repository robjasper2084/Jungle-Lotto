# LottoMind: Jackpot Maze

An original React + TypeScript + Phaser 3 maze-chase browser game. It uses secure random lottery-number generation for entertainment-only reveals and never claims to predict lottery results.

## Run locally

```powershell
npm install
npm run dev
```

Open the Vite URL ending in `/games/lottomind-jackpot-maze/`.

## Verify and build

```powershell
npm run validate:assets
npm test
npm run build
npm run preview
```

The deployable PWA is written to `dist/`. The source is standalone and does not overwrite another game.

## What is included

- Pick 3, Pick 4, Mega Millions, and Powerball rule configurations
- Rejection-sampled `crypto.getRandomValues` generation
- Three original, compact arcade mazes with continuous neon walls, spaced jumbo pellets, side tunnels, power orbs, and a vault progression loop
- Five villain types: Tax Man, Grim Reaper, Chaos Ex, Envy Crew, and the Jackpot Patrol police robot
- Generated mascot, enemy, boss, collectible, power-up, and environment art
- Keyboard and touch controls, pause, mute, reduced motion, high contrast, game speed, and screen-shake settings
- Local saved-number wallet and PWA offline precache
- Vitest coverage and CircleCI build/test/asset validation

The maze-chase rules use familiar arcade conventions, while the code, Detroit environments, lottery systems, characters, villains, UI, and artwork are original LottoMind material.

## Documentation

- [Controls](docs/CONTROLS.md)
- [Asset replacement](docs/ASSET_REPLACEMENT.md)
- [Lottery rules](docs/LOTTERY_RULES.md)
- [Embedding](docs/EMBEDDING.md)
- [Asset-generation prompts](docs/ASSET_PROMPTS.md)

## Disclaimer

For entertainment purposes only. LottoMind does not predict or guarantee lottery results. Play responsibly.

## Canonical media (no duplicate source/public files)

All 42 game media assets (17.25 MiB) now live only in the published sibling `../assets/` directory. The source project does **not** commit second copies in `source/public/assets/`.

NPM's `predev`, `pretest`, `prebuild`, and `prevalidate:assets` lifecycle commands verify every canonical Git-blob checksum and stage the required assets in the ignored `.generated-public/assets/` directory. Vite uses that generated public directory without changing game asset URLs, PWA caching, or the production game files. Run the normal `npm run build`, `npm test`, or `npm run validate:assets` from `source/`; no manual copy is required. If the canonical media changes intentionally, update the pinned manifest and its tests with the new hashes. The staging command refuses missing, modified, or mismatched files before changing its output.
