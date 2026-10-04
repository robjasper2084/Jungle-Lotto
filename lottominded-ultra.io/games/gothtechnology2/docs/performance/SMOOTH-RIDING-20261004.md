# Paired riding performance release - 2026-10-04

Source baseline: `90c3e9a2266d96fdd4f8721d0b97de353dc37cf5`. This release packages Swoop Detroit and the actual separately packaged Elmwood Explorer. Other concurrent artwork, storefront and menu edits are excluded.

## Changes

- Exact nearest-lane segment index replaces repeated exhaustive terrain scans; lane elevations, curb and bridge rules, and tie ordering remain intact.
- Frame deadlines retain their phase through small callback delays instead of accidentally dropping alternate frames at a requested 60 Hz.
- Swoop's chase camera samples the same fixed-step interpolation fraction as its rider.
- Asset priority sorting runs at most ten times per second during ordinary streaming; explicit warm-up and completion still pump immediately.
- Compass ticks are reused. Swoop diagnostic JSON updates at the HUD cadence. Navigation obstacles are filtered before allocating distant solid records and impact callbacks.
- Explorer exposes bounded CPU/update/render p95 measurements alongside its existing frame timing readout, to distinguish remaining rendering cost from movement cost.

## Measured CPU benchmark

`node --experimental-transform-types scripts/benchmark-turns.ts` in the real Explorer source: 21,816 terrain queries over 606 mapped segments, six runs with the first discarded. Median before: 2176.906 ms. Median after: 130.3582 ms. This is a **94.0% reduction in CPU time for this query workload**, not a claim of 94% higher FPS. Both checksums were exactly 385352.16538511455.

## Local validation performed

- Swoop `npm run check` passed.
- Explorer `npx tsc -p tsconfig.riverwalk.json --noEmit` passed.
- Swoop camera, embedded Elmwood, mapped ride and actor avoidance tests: 31 passed. The mapped Cut simulation completed 2559.2 m in 405.75 s with maximum centerline drift 0.386 m.
- Swoop frame schedule tests: 2 passed, including jittered 60 Hz and 144-to-60 Hz rendering, idle and XR handling.
- Explorer indexed terrain, real mapped terrain, streaming, frame schedule, camera and riding polish tests: 21 passed.
- Both isolated local preview Vite builds passed.

Commands:

```text
node --experimental-transform-types --test src/detroit/cameraInterpolation.test.ts src/detroit/elmwood.test.ts src/detroit/mappedRide.test.ts src/detroit/actorAvoidance.test.ts
node --experimental-transform-types --test src/detroit/frameSchedule.test.ts
node --experimental-transform-types --test src/detroit/segmentIndex.test.ts src/detroit/elmwood-terrain.test.ts src/detroit/elmwood-streaming.test.ts src/detroit/frameSchedule.test.ts src/detroit/elmwood-camera.test.ts src/detroit/elmwood-riding-polish.test.ts
```

## Limits and next verification

Local Chrome Explorer rendering still measured approximately 27-30 FPS in an active sample with multiple game tabs open and the RTX 3080 using 8666/10240 MiB VRAM. A short cruise covered roughly 150 m; it did not constitute a controlled complete-map playthrough. A Swoop Chrome review tab timed out and was closed. These samples do not establish a zero-stutter result, a steady 60 FPS, physical-phone performance, or complete graphical route coverage.

Next runnable task: use the released Explorer performance readout and per-stage canvas measurements on a repeatable entrance-bend route, with one game tab and fixed quality/resolution; compare active movement and render p95. Repeat Swoop's route at the same settings, then check browser phone-size controls. Hosted LOVE TAG server verification remains a separate existing release limitation.

Publication state and exact source/generated revisions will be recorded after the scoped build and GitHub deployment complete.

## Isolated release build

Packaged against source revision `0c62d1acee42644d5066c1f93526ba1dc929f3d8` after merging production `8d89e4e55dcaa71ba2e0d0b737cdad976b40c5d5`. Shared RideCore was compiled from the versioned release source. Both release source type checks passed; Swoop selected tests passed 33/33 and Explorer passed 21/21. The Explorer audit-output directory was created before the retry (the first run failed only while writing its report to a missing directory). Existing production map, model, audio and texture bytes were retained.

Generated entries: Swoop `detroit-CQx51PY5.js` with `main-DE-rcfwk.js`; Explorer `elmwood-D9eW2LaB.js`. Public deployment verification is pending.
