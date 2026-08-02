# Staging Test Report

## Detroit artwork update

- The built static game loads the generated Detroit board, transparent mascot/token art, gateway sprites, venture-level sprites, Guardian Vault, and both 24-card atlases without console errors.
- Desktop 1440 first-turn gameplay passed after the artwork integration.
- Mobile 390 and tablet 768 first-turn plus four-local-player flows passed 4/4.
- The complete 13-round Standard test remained green during the artwork pass.
- In-app browser inspection confirmed a clean console and visible labels for the Downtown sports district, Michigan Central, Renaissance Center, Eastern Market, Belle Isle, the Ambassador Bridge, the Gordie Howe International Bridge, and major streets.

Verified locally on 2026-08-02 from protected branch `upgrade-redesign`. No production deployment occurred.

## Results

| Layer | Command / check | Result |
|---|---|---|
| TypeScript | `npm.cmd run typecheck` | Pass |
| Engine/content | `npm.cmd test` | 18 tests pass |
| Automated balance | 1,000 Quick 313 + 100 full Standard CPU matches | Pass; no deadlocks or invalid balances |
| Game browser matrix | `npm.cmd run test:e2e` | 18/18 pass across 360×800, 390×844, 768×1024, 1366×768, 1440×900, 1920×1080 |
| Full match browser proof | Standard solo, thirteen rounds | Pass; results and score table reached |
| Arcade integration | Focused parent Arcade pilot | 2/2 pass (desktop/mobile) |
| Source validators | `check:site`, `check:home` | Pass; 16 pages and 67 home references |
| Staging build | `LOTTOMIND_STAGING_TEST_PORT=8330 npm.cmd run staging:test` | 25 pages, 567 same-origin references, 10/10 pass |
| Route matrix | `npm.cmd run routes:test` | 150/150 pass across source/staging desktop, mobile, tablet |
| Dependency audit | `npm.cmd audit --audit-level=moderate` | 0 vulnerabilities |
| Live Browser | roll → route choice → animated arrival → action state | Pass; no console errors/warnings |

Screenshots are in `docs/screenshots/` for 1440×900 desktop and 390×844 mobile first-turn action states.

## Staging safety

The generated preview is noindex and visibly marked by the parent staging guard. No live payments, redemption, account writes, direct credit grants, or production analytics are enabled by this game. The secure reward adapter refuses to submit when no isolated verification endpoint is configured.

## Known limitations

- Final production illustration, token sheets, card art, environmental layers, and original audio remain placeholders; production prompts and the asset replacement manifest are included.
- Online private rooms are Phase 2.
- Static Beta cannot issue LottoMind Credits and cannot send saved numbers unless the existing authenticated services are configured.
- Dedicated two-finger pinch math is not yet implemented; touch drag and browser/trackpad zoom work.
- Phaser's Canvas renderer is intentionally selected for broader tablet compatibility; the current minified Phaser chunk is approximately 1.2 MB (332 KB gzip).
