# Race, rider and water polish — October 4, 2026

Local review checkpoint. The current task is not fully complete, and no live build was promoted. These changes target the actual Swoop source and the separately packaged Elmwood Explorer; Swoop's internal Elmwood map is not used as a substitute.

## Result

- Swoop's default race has exactly three opponents, including when the expanded costume list contains the Night Sentinel. The former fourth AI had no valid grid slot. The place display now uses the actual roster size.
- Swoop's bicycle pace and drag compensation are improved, with faster lateral movement and less unnecessary braking when a committed passing line is clear. Existing EUC difficulty tuning is preserved.
- Standalone Elmwood's Creek Lane race now has three actual simulated opponents, a four-place HUD, ordered gates, finish times, and recovery at the last earned gate. A race has no time cutoff. The two-minute trick session retains its cutoff.
- Elmwood's pack advances all riders on interleaved 120 Hz steps, checks live actors as well as scenery, and commits to passing. A blocked bicycle physically reverses before rejoining its route. This fixed browser stalls that static-only tests initially missed. Walkers also avoid race riders.
- Bicycle torso fitting retains elbow bend; hands follow the actual grips with stable feet on the pedals. Existing EUC arm balance, bike lean, fall and settle behavior are retained and checked where listed below. New fall animations/art are not claimed.
- Elmwood's existing creek and pond now use moving normal layers, small waves, shoreline/depth shading and downstream creek flow. Rain/fountain ripples and soft ballistic fountain spray share a pausable water clock. Detail scales with graphics quality and freezes for reduced motion. No new waterfall model was added.
- Solo Elmwood touch controls are fitted into the current viewport, kept clear of one another and of the map on short screens. Saved sizes/positions are not rewritten. The landscape race HUD is moved above the left thumb. Swoop race/map/compass have separate phone lanes; its recording toolbar no longer covers race feedback. Dog commands start collapsed on phones and have a 44px expand target clear of their custom pads.
- The current armored-rider asset is copied from the real source project into both separate review packages instead of requesting it from an older external pack that lacks it.

## Sources changed for this work

- `swoop-source/src/detroit/{racePilot,raceRules,raceView}.ts`
- Actual `C:/Users/digit/Documents/phone/euc-detroit-riverwalk/src/detroit/{elmwood-race,elmwood-gameplay,elmwood-main-menu,elmwood-ride,elmwood-water,elmwood-weather,elmwood-environment,elmwood}.ts`, race/water tests and `elmwood-mobile-hud.css`; matching `elmwood-source` files.
- `C:/Users/digit/Documents/phone/Digital_Static_RideCore/src/cyclingView.ts` and actual Explorer/mirror `riding/bicycleView.ts`.
- Product packaging scripts, `scripts/elmwood-explorer-embed.js`, and new `scripts/elmwood-touch-layout.mjs` / test.
- LOVE TAG browser verification fixes are described in `love-tag/STATUS.md`; shared `tagClient.ts`, `tag/rules.ts` and its regression test were changed.

Exact source/build SHA-256 identities are in `love-tag/evidence/race-water-revisions-20261004.json`. Existing unrelated dirty work is retained.

## Commands and results

Run from each named source directory; logs live in `docs/love-tag` in the packaging project.

| Command | Source | Actual result / log |
|---|---|---|
| `node --experimental-transform-types --test src/detroit/race.test.ts` | Swoop | 17 PASS; `race-swoop-roster-final.log` |
| `node --experimental-transform-types --test src/detroit/elmwood-race.test.ts` | Actual Explorer | 6 PASS; `race-elmwood-backoff-final.log` |
| `node --experimental-transform-types --test src/detroit/elmwood-water.test.ts src/detroit/elmwood-landmarks.test.ts` | Actual Explorer | 7 PASS; `water-and-landmarks-final.log` |
| `node --experimental-transform-types --test src/detroit/elmwood-bicycle-fit.test.ts src/detroit/ride-motion.test.ts` | Actual Explorer | 8 PASS; `motion-elmwood.log` |
| `node --experimental-transform-types --test src/detroit/elmwood-riding-polish.test.ts` | Actual Explorer | 4 PASS; `riding-polish-current.log` |
| `node --test scripts/elmwood-touch-layout.test.mjs` | Packaging project | 4 PASS; `touch-layout-final.log` |
| `npm run build` | RideCore | PASS |
| `npx tsc --noEmit` | Swoop | PASS |
| `npx tsc --noEmit -p tsconfig.detroit.json --types vite/client` | Actual Explorer | PASS; broader root typecheck retains pre-existing test/import-meta configuration failures |
| `node scripts/build-love-tag-preview.mjs` | Packaging project | PASS; latest `build-local-final.log`; only separate review outputs |

The Swoop tests traverse the real Cut-to-Mack course with all gates, three EUC difficulties, bicycle packs, seeded props, route traffic, a stopped player and parked companion. They also check blocked recovery, gate order and finish. The final expert obstacle run had zero impacts and minimum rider separation in the stopped-player test was 1.28 m. Cruise bicycle finishes improved from roughly 513–574 s to 460–474 s in the seeded test.

The Explorer tests traverse the real Creek Lane with all three bicycle/EUC opponents, 15/30 Hz render-frame inputs, and a stopped roaming cyclist. Final bicycle finishes were 48.73–50.67 s; all tested riders finished without recovery. Earlier failing experiments are retained in logs.

## Actual browser evidence and limitations

`love-tag/evidence/race-pack-browser-20261004.json` records full real-browser **rival** courses: Swoop's three bicycles finished all 12 gates to Mack (371.35–384.28 s), and Explorer's three bicycles finished Creek Lane with zero recoveries. The human player stayed at the grid. A manual human ride over every gate/obstacle/recovery point in both products is **NOT RUN**, and these rival/controller results must not be described as that playtest.

Phone evidence records effective DOM viewports, not physical phones. Portrait 390×844 and landscape 844×390 were inspected. The viewport backend pads screenshots beyond the tested viewport; the receipts give actual dimensions. Existing saved 82 px Hop remained intact. Concurrent real fingers, device thermals, gamepad and VR remain untested.

The water material rendered in the actual pond browser view (`elmwood-water-20261004.png` in the session visualization folder). Component tests cover stream-segment direction, pond depth, footprint preservation, pause and reduced motion. Additional browser pause/reduced-motion evidence is in `love-tag/evidence/water-phone-browser-20261004.json`. No claim of physical mobile performance or photographic realism is made.

## Next runnable work

1. Use both local review entries on port 8212 to drive the human racer through the complete course, intentionally miss/recover at gates, finish and retry. Record each actual interaction and camera/fall issue, then repair any failure.
2. Verify simultaneous thumb steering/braking and camera/recovery on physical portrait/landscape phones, retaining the current customized layout. Profile the heavy Explorer scene on those devices.
3. Finish the LOVE TAG acceptance gaps and the known Explorer Tag-bot lane-boundary failure in `love-tag/STATUS.md`. Its AI is separate from the passing normal race pack. Hosted verification requires an authorized HTTPS/WSS service and separate-network devices.
