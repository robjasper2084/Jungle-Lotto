# Static Royale opening stalls — local fix, 2026-10-22

Status: rebuilt locally; not deployed. Review at http://127.0.0.1:8261/arcade/swoop-detroit/royale.html?openingFix=20261022&profile .

## Changes

- Prepare the existing ten-rider roster and nearby cyclist rigs while the loading screen is active. Upload their buffers/textures and compile shaders before releasing controls. Hidden actors retain their visibility and culling flags even if preparation fails.
- Cache each hero's standing leg/arm measurements without advancing animation history or changing its mounted pose. Previously the first dismount/AI knock-off could perform this work during play; one intermediate profile measured 265 ms in rider presentation.
- Initialize heart-trail and impact instance-color buffers before shader preparation. Previously the first hit could change the shader variant; an intermediate profile recorded a 660 ms submission stall and a new program at that point.
- Build the immutable navigation nearest-node index during arena preparation. Its first use cost 65–74 ms in the measured runs and previously occurred in the first AI simulation step.
- Use a cheap elapsed-time getter for opening instrumentation, rather than sorting frame samples to decide whether to record a trace.
- Preserve traffic simulation, physics, collision, actor counts, visibility rules, and existing animation history. Preserve the preceding optimized-media package; rebuild code without copying original large media back into the preview.

Source files changed for this task:

- `ride-core/src/startupFrames.ts`
- `ride-core/src/cyclingView.ts`
- `ride-core/src/ambientCyclists.ts`
- `ride-core/src/onFootRider.ts`
- `swoop-source/src/detroit/actors.ts`
- `swoop-source/src/detroit/warmFirstView.ts`
- `swoop-source/src/detroit/royale/main.ts`
- `swoop-source/src/detroit/royale/impactEffect.ts`
- `swoop-source/src/detroit/royale/heartProjectiles.ts`
- Tests: `warmFirstView.test.ts`, `heroPoseBudget.test.ts`, `cyclistWarmup.test.ts`, `royale/effectWarmup.test.ts` under `swoop-source/src/detroit`.

The checkout also contains extensive pre-existing edits. This list is not a claim that the entire working-tree diff belongs to this task.

## Opening measurements

Desktop embedded Chromium, 1600×900, Automatic/Balanced, 60 FPS target, shadows off, armored rider, Classic EUC, ten-rider offline practice, stationary opening. Measurements come from requestAnimationFrame intervals and instrumented work, not video encoding. The benchmark window is the first 30 active seconds after preparation; loading is reported separately. Randomized simulation/visible actor load and system load vary, so these are observed runs, not a sustained FPS guarantee.

| Run | Average FPS | p95 frame | p99 frame | Worst frame | Frames >50 ms | Frames >100 ms | Max riders |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Original local baseline | 57.4 | 16.8 ms | 33.5 ms | 216.7 ms | 12 | 4 | 10 |
| Fixed, first full-size run | 57.0 | 33.2 ms | 33.4 ms | 50.0 ms | 0 | 0 | 10 |
| Fixed, fresh repeat | 43.7 | 33.5 ms | 50.0 ms | 67.0 ms | 4 | 0 | 10 |

The long opening stalls were absent in both final samples. Overall frame pacing remains variable and sustained 60 FPS is unfinished. Preparation took 2.36–2.47 seconds after Deploy. Page-ready telemetry was 22.0 seconds in the baseline and 27.3–28.2 seconds in the final samples; this work does not establish faster total loading. It moves first-use work out of active gameplay.

Raw evidence: `C:/Users/digit/Documents/phone/output/royale-opening-stalls-20261022/`:

- `before.json`, `after-nav.json`, `after-repeat.json`: full frame reports, quality settings, actor/render loads, module names, and opening traces.
- Intermediate `after-warm.json`, `after-foot-warm.json`, `after-effects.json`: isolate successive first-use bottlenecks. These were at 1280×720 and must not be used as equal-resolution FPS comparisons.
- `after-repeat.png`, `local-review.png`: local review screenshots.
- `final-tests.txt`, `source-typecheck.txt`, `core-build.txt`, `nav-warm-build.txt`: validation output.

## Verification

- 35 focused tests passed: shader/texture preparation and failure cleanup, all-five-hero warm-fit equivalence, cyclist warm-up without moving traffic, stable effect color buffers, actor visibility, interpolation, animation presentation, startup metrics, ambient packs, on-foot state, respawn, and work slicing.
- Canonical RideCore build passed. Source type check passed using the current local RideCore declarations, matching Vite's local alias. The normal installed-package check resolves stale linked RideCore exports and still reports those existing errors; the temporary source-check config is saved with the evidence.
- Source build and generated page/package validation passed. The served entry is `royale-C3Ybz_GF.js`, matching the rebuilt artifact byte-for-byte (SHA-256 `eff998cdf470a00d5ef7d2bfa8d4fe2be1e45209e8844a21be4221e762067063`).
- Browser console: no captured errors in the fresh repeat.
- UI smoke: deployment into ten-rider practice; dismount to on-foot state; elimination; respawn restoring health to 100 and reducing stock 3→2; firing reducing magazine 20→19; reload restoring magazine 20 with reserve 59; round-one results screen.
- No full three-round, physical iPad, reduced-motion OS setting, or remote online performance verification is claimed. Roster preparation is currently in offline practice/training/rematch; global navigation/effect fixes are shared, but online opening performance needs its own measurement.

## Remaining

Physical iPad retest is required. Busy-area steady-state performance and total loading time remain separate work. No production deployment, hosting changes, or voice changes were performed.
