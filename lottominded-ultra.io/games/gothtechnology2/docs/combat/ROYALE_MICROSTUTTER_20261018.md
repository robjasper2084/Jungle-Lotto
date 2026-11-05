# Royale motion and first-person review

Local development branch: upgrade-redesign. No commit, push or deployment.
Preview: http://127.0.0.1:8261/arcade/swoop-detroit/royale.html?motionReview=20261018&profile=1

## Confirmed findings

- Royale advanced at a fixed 60 Hz but drew the latest simulation/prediction position directly. Display callbacks between ticks could repeat a pose then jump to the next one. Both the hero and follow camera used this stepped movement. Swoop already interpolates its 120 Hz poses; its remaining hitches are not proof of the same missing interpolation.
- Uneven frame delivery is a separate confirmed problem. A populated match produced 33–50 ms frame intervals. Interpolation cannot replace missed frames.
- First-person hands were instantiated only while on foot. Mounted FPP used the world weapon. The reference recording at 106 seconds shows the unsupported weapon presentation. The hands were also too low at hip aim.
- The touch hint advertised riding cruise while walking. Round counts lacked a label.

## Changes

- Render-only interpolation of offline actors and local online prediction between fixed steps. Actor and follow camera consume the same sampled base pose. Remote online buffering is preserved.
- Shortest-arc heading interpolation and continuous foot-phase interpolation.
- Respawn identity, death, teleport and mount-state changes snap to the valid current pose. Physics, combat authority, input and projectile calculations are unchanged.
- Enabled the existing first-person hands/weapon rig while riding. Raised and moved hip-aim presentation forward; full ADS placement is unchanged.
- Both hands remain inside the tested 16:9 view for all five heroes while standing or mounted. Shared rider models and their 30 finger joints remain intact.
- Walking hints and round labels reflect the actual mode/state.
- Frame reporting now includes p50/p95/p99, maximum interval and late-frame counts. Optional ?profile=1 records CPU simulation/input, visual update, and render submission/capture timing. GPU completion time is explicitly unmeasured. Visibility changes reset the frame sample window.

## Measurements and limits

Windows desktop, in-app Chromium browser. Recent hardware diagnosis identified RTX 3080; hardware was not independently queried again here. Recording disabled. Automatic quality changed detail/resolution during the run; these are diagnostic samples, NOT a controlled before/after optimization benchmark.

| Sample | Conditions | FPS | p50 / p95 / p99 ms | Calls / triangles |
| --- | --- | --- | --- | --- |
| Before interpolation | Existing stationary/spectator view; 2314×1207 backing buffer; Automatic | 58.51 | unavailable / 16.8 / unavailable | 510 / 1,265,260 |
| Populated practice, after | Started with 10 seats and auto-fill; captured snapshot has 3 actors, 2 alive, after elimination/spectating; 1280×720 CSS, 1920×1080 backing, detail .75, resolution scale 1 | 48.59 | 16.7 / 33.4 / 50.0 | 413 / 1,153,057 |
| Quiet range, after | One rider, mounted FPP; Automatic scale .7, detail .65 | 60.00 | 16.7 / 16.8 / 16.8 | 289 / 884,236 |

The populated snapshot's CPU p50/p95: simulation/input 4.8/15.1 ms, presentation 4.1/12.7 ms, render submission/capture 6.2/8.9 ms. The earlier moving sample reached 40.50 FPS with simulation/input p95 20.1 ms and presentation p95 12.3 ms. CPU render-call timing is not GPU time. Actor counts describe the current received snapshot, not the entire match population or rendered pixel visibility.

Warm/local preparation reported 33.963 seconds to the ready boundary. Menu wait is excluded. Cold cache transfer/decode timing was not measured. No loading-speed improvement is claimed by this pass.

## Verification

- TypeScript client check passed.
- 15 focused tests passed, including variable/90/120/144 Hz display sampling against 60 Hz movement, heading/foot wrapping, discontinuities, no mutation of simulation state, all five heroes' hand/finger rigs, reduced-motion behavior, holster/reload and frame scheduling.
- Local production-code bundle built and opened through the nested game route.
- Browser: populated practice, mounted FPP, on-foot forward/backward movement and pickup/remount flow. Correct walking hint observed. No console warnings/errors in the sampled range.
- Evidence: C:/Users/digit/Documents/phone/output/performance-audit-20261018/motion-route-sample.json, motion-tests.log, mounted-hands-fixed.png, reference-mounted-fpp.png.

## Build and resource status

The full package rebuild failed with ENOSPC while staging unchanged media. Only this pass's failed staging directory was removed. Source assets and existing builds were preserved. A smaller local code-only Vite build reused existing packaged assets:

    node C:/Users/digit/Documents/phone/output/performance-audit-20261018/build-royale-code-review.mjs

The generated HTML before this pass is saved in C:/Users/digit/Documents/phone/output/performance-audit-20261018/before-motion/royale.html. Existing hashed assets were retained for rollback. This is a local review build, not a complete release package. About 477 MB free disk remained at the last check.

## Still pending from the attached performance brief

- A controlled, fixed-quality route comparison and sustained maximum-population encounter benchmark.
- Detailed load-stage and GPU timings; cold-cache measurements.
- Separate transfer/decode priority queues, incremental nearby-world activation, cosmetic prioritization, cancellation and bounded resource eviction.
- Measured scenery/character LOD and shadow-cost work; combat-relevant cover/opponents must remain visible.
- Scope/HUD cleanup, all-device visual review, underpass-wall remount and full lifecycle/resource-growth checks.
- Physical iPad/mobile retesting. Quiet desktop 60 FPS does not establish busy-route or mobile stability.

The full attached checklist is not complete. This pass fixes a specific motion-presentation defect and verifies the remaining frame-budget problem.
