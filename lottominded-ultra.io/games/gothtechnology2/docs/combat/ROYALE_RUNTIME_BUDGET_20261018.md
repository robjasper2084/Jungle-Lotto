# Runtime budget and companion presentation follow-up

## Release boundary

Completed game work was published through PR #106, release commit c0b5475ee7239abbdf3293f9cfca86026279f666, merge 6365ea821deb707d1d892a4e2524409b90f54eb8. GitHub Pages run 39191291439 completed both build and deployment successfully. At 2026-10-19 02:59 UTC, all three public routes returned HTTP 200 and referenced the expected new entry bundles; those bundles also returned HTTP 200. Receipt: live-verification.json in the evidence directory.

The release rebuilds Swoop Detroit, Static Royale and Elmwood entry modules using their production transforms. Existing unchanged media are reused and both complete package dependency graphs are validated. Startup pages remain game launchers; studio pages are separate routes.

The companion and helmet fixes described below were resumed after that release snapshot and are excluded from c0b5475e. They are prepared as a separate tested Swoop Detroit / Static Royale release, with Elmwood retaining its current deployed build. The follow-up release receipt and live verification are recorded separately in the evidence directory.

## Completed runtime changes

- Exact nearest-node spatial index over 14,338 navigation nodes, preserving eligible-node filtering and insertion-order ties.
- Bounded 256-entry route cache stores node sequences; projections and returned arrays remain caller-owned.
- Conservative rotated-box BVH narrows collision/ray candidates without replacing exact collision checks or their original ordering.
- Nearby Royale pickups allocate within 100 m and release beyond 140 m; collected pickups release immediately. Pickup authority is unchanged.
- Skip mounted pose construction once fully on foot. Update bone matrix paths as needed and publish complete branches once.
- Cache each companion's shadow-quality setting rather than traversing every mesh every frame.
- Focused Royale action buttons no longer swallow movement keys. Enter/Space activation and editable-field exclusion remain intact.
- Render-only actor/camera interpolation and mounted first-person hands from the earlier motion pass are included.

## CPU benchmark

Windows desktop, Node 24.16, original compact downtown fixture, BreadFlower engine, seed 42, ten actors, 60 Hz simulation, 1,800 steps per run, snapshot each step. Three runs per version; later runs benefit from route-cache warmup. This is CPU simulation timing, not GPU time or a 60 FPS claim.

| First run | Before | After |
| --- | ---: | ---: |
| Step p50 | 2.385 ms | 1.365 ms |
| Step p95 | 13.515 ms | 2.397 ms |
| Step p99 | 17.733 ms | 9.654 ms |
| Maximum step | 27.022 ms | 15.607 ms |

All three before/after runs preserve the same final state hash: 4315d0b7da093cbfbe13d1edea8bc7b9aab24d1062e10b7c3f8d601b659df1ee. Nine actors remain alive and 112 shots were fired. The fixture hash is 14410cf246bba2c9574ec503ed937980543eacfe2a7c7c8d9857584c465c7cdb.

Pose comparison covers five heroes and seven modes: all 672,000 sampled matrix values are identical across the matrix-update optimization.

## Dog/helmet follow-up fixes

- The supplied dog material has a metallic/roughness texture with default metallic factor 1. Coat materials now use metalness 0, roughness 0.94 and reduced normal strength while retaining the supplied color texture. Each view owns its materials; shared textures/geometry are not disposed with a dog. Royale's per-player coats remain supported.
- Widen visual paw-contact easing to avoid abruptly releasing a planted foot. At 2 m/s, the worst sampled bone displacement between 144 Hz frames falls from 63.73 mm to 29.43 mm (about 54%). At 6 m/s it falls from 62.44 to 57.66 mm. This is an animation continuity measurement, not a frame-time measurement.
- Interpolate Royale pitch, roll, turn rate, jump height and jump progress alongside its existing position/heading/phase interpolation. Landing finishes the pounce rather than reversing its tuck.
- Helmet decals maintain approximately 4 mm shell clearance, use outward-facing surfaces and a matte material, and retain depth testing. Lower alpha rejection preserves small logo edges.

## Verification

- 53 earlier focused physics, combat, spatial and hero-pose tests passed.
- 26 release regression tests passed; client and RideCore TypeScript checks passed.
- 15 companion follow-up tests passed: real dog gaits, ground clearance, planted contacts, skin continuity, paused poses, turning, material ownership, shell clearance and interpolation. Client TypeScript check and local production-code rebuild passed afterward.
- Local browser: Swoop ride, braking, dismount and walking with helmet/companion visible; Royale mounted/on-foot input and range, including the updated dog during forward movement and turning; Elmwood rebuilt startup and game menu. Sampled Swoop and Royale console logs were clear.
- Quiet Swoop desktop snapshot after the companion changes: 480-frame p50 16.7 ms, p95 16.8 ms; RTX 3080, Auto, pixel ratio 1.5. This stationary/open-road sample does not establish sustained busy-area performance.

Evidence directory: C:/Users/digit/Documents/phone/output/performance-audit-20261018.

Key evidence: cpu-before.json, cpu-after.json, poses-before.json, poses-after.json, dog-flicker-before.json, dog-flicker-after.json, release-tests.log, dog-helmet-tests.log, completed-release-build.log, dog-helmet-local.png.

## Still outstanding

Busy-area sustained 60 FPS, controlled fixed-quality GPU profiling, cold iPad loading/memory and five-minute ride retesting remain unverified. Low frame delivery can still make all movement look jerky even after fixing pose interpolation and paw contact. A desktop visual sample does not conclusively rule out device-specific shading flicker.

Pages deployment publishes browser builds and server source; it does not restart a running multiplayer host, renew a relay or verify the live authoritative host version.
