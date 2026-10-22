# Opening performance and full-match verification — 2026-10-22

Local source/build work on `upgrade-redesign`. No production deployment. Existing uncommitted respawn, presentation, recovery, menu and input work was retained.

## Changes in this pass

- Automatic starts Balanced on capable desktops and Smooth on mobile. Automatic shadows stay off from startup rather than changing shadow shaders during play. Explicit HD/Ultra and shadow overrides remain available.
- Added **Stable · 30 FPS target** alongside Smooth 60. This saves the shared preference, uses 512px textures, no dynamic shadows, a 180m scenery radius and a limited render resolution. The target is not a device guarantee.
- Royale budgets source and cloned character/equipment textures before display. Off-camera rider IK, equipment presentation and dog presentation are skipped; nearby actors are retained for shadows. Authoritative actors, AI, hitboxes and collision remain active.
- Royale waits for nearby streamed art and GPU preparation at the selected spawn before releasing the opening view. The same preparation runs on local next-round/rematch entry. Required terrain/collision is loaded before the session starts.
- Elmwood stops rendering the full world behind its startup screen/menu. Rider, dog, nature and nearby landmark preparation finishes before controls open. Adaptive resolution changes no longer rescan all scene textures.
- Elmwood Automatic/Smooth/Balanced use the existing authored LOD1 elm, maple, oak, pine and willow assets. They retain species/materials and have about 58% fewer triangles. HD/Ultra use the original versions after restart; Settings exposes a tree-detail restart when needed. Landmarks and collision are unchanged.
- Added bounded first-30-second frame statistics, retained after the opening interval so later calm views cannot replace the opening evidence.
- Added a complete ten-rider test using the compiled engine and actual downtown collision fixture.

## Measurements

Windows desktop, embedded Chromium, 1280 × 720 captured view, Automatic graphics. No build/test processes were running during the final browser samples. Browser GPU timer data was unavailable. These are measured display-frame and CPU times, not video-encoding FPS or physical iPad results.

| Sample | Frame rate | p95 frame | Worst frame | Other observations |
|---|---:|---:|---:|---|
| Royale before: three 2-second windows | 36–45 FPS | up to 50ms | up to 200ms | 821–986 calls; 1.33–1.98M triangles; 3 snapshot actors |
| Royale final: first 30 active seconds | 55.7 FPS | 16.8ms | 766.7ms | 3 frames over 100ms; 10 combatants; CPU p95 18.6ms |
| Royale final: later 2-second window | 60 FPS | 16.8ms | 16.8ms | 403 calls; 0.98M triangles; 3 snapshot actors |
| Royale Stable 30: four later windows | 30 FPS | 33.4ms | 33.7ms | 275–278 calls; 2 snapshot actors; no late frames in these windows |
| Elmwood before: entrance windows | 30 FPS | — | — | 727 calls; startup read also timed out |
| Elmwood final: first 30 active seconds | 59.7 FPS | 16.8ms | 50ms | No frames over 50/100ms; one local rider; CPU p95 12.1ms |

Elmwood's comparable entrance view changed from about 6.8M to 5.1–5.2M triangles with the LOD switch, at 275–277 draw calls. Ambient cyclists/community riders remain enabled. Before the render gate, the startup scene submitted about 1,407 calls behind the menu; the revised startup screen does not render the world continuously.

Important limits: the old build did not retain a first-30-second aggregate, so before windows and the final opening report are not identical intervals. Royale uses randomized starts/AI and different visible actors between runs. The final Royale report still contains substantial opening stalls; sustained 60 FPS is **not** established. The entrance samples do not prove frame pacing throughout either map. Royale's local arena preparation was about 24 seconds; Elmwood's 3.4-second world/menu readiness excludes subsequent rider preparation and is not total playable loading time.

## Match and control verification

The compiled-engine downtown test ran ten riders through three complete rounds without changing clocks, health or phase fields to force completion:

- Round 1: 35,642 ticks, simultaneous elimination.
- Round 2: 36,240 ticks, Static Field deadline.
- Round 3: 36,240 ticks, Static Field deadline.
- Natural elimination offered re-entry. Acceptance restored health 100/shield 50, decremented stock 3→2, advanced spawn serial and applied 600 ticks of protection.
- Movement and firing were accepted after respawn. Delayed spectating selected a living target and retained its three-second delay.
- Result/series accounting completed all rounds. Starting a new match reset round, scores, health, stock, sequence and shot state.

Direct browser checks additionally observed deployment and an actual elimination; clicked **Respawn · 3 left**; verified health 100, shield 50, stock 2/3 and the protection label; then fired (ammo 20→19), toggled ADS and dismounted. Spectator Next switched AI 1→AI 2. An earlier browser round reached results and displayed Next round 2/3. This is not a claim of manually watching all three full rounds in the browser. A later keyboard reload/remount attempt was interrupted by another AI elimination and is not counted as a successful keyboard check.

Elmwood's Pause then Recover returned to active riding. No browser warnings/errors were captured in the final Elmwood run.

## Validation and files

- 41 relevant regression tests passed, plus the full downtown three-round test (42 checks total).
- Swoop and Elmwood merge-check TypeScript checks passed.
- All three local game entries rebuilt and package validation passed. Known large Elmwood JavaScript chunk warning remains.
- Served modules verified in the DOM: `royale-CWBhPoBR.js`, `elmwood-Ch0BkJKb.js`.
- New LOD models and every referenced shared texture exist in the local served package. Their list is included in the normal Elmwood release builder.
- Relevant diff whitespace check passed.

Main source changes: `swoop-source/src/detroit/graphicsQuality.ts`, `royale/main.ts`, `royale/companions.ts`, `royale/detroitScene.ts`, new `royale/actorVisibility.ts`; `elmwood-source/src/detroit/sharedGraphicsQuality.ts`, `elmwood.ts`, `elmwood-ride.ts`, `elmwood-quality.ts`, new `elmwoodTreeDetail.ts`; new `ride-core/src/startupFrames.ts` and `ride-core/tests/royale-full-match.test.ts`; `scripts/build-elmwood-explorer.mjs`, associated regression tests and rebuilt local entries/assets.

Evidence: `C:/Users/digit/Documents/phone/output/startup-match-20261022/` contains before/after JSON, frame windows, type/build/test logs, the full-match log, `royale-respawn.png`, and Elmwood screenshots before/after its LOD adjustment. The small `stage-tree-lods.mjs` helper stages only the five new preview models with the release builder's shared-texture layout because disk space is limited; normal future releases use the updated builder asset list.

## Still open

- Royale's remaining opening stalls require a more detailed GPU/upload/allocation trace; this pass does not establish a stutter-free 60 FPS mode.
- Physical 2020 iPad Pro Chrome loading, three-minute riding/curb/freeze and recovery retests remain necessary. No new physical-device test was run here.
- Full-map sustained performance, thermals and network voice were not retested in this pass.
- Production remains unchanged.

Local review:

- http://127.0.0.1:8261/arcade/swoop-detroit/royale.html?startupFix=20261022&profile
- http://127.0.0.1:8261/arcade/elmwood-explorer/elmwood.html?startupFix=20261022&profile
