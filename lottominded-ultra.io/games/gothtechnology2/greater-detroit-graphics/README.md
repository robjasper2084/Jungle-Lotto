# Greater Detroit Simulation — graphics calibration stage 1

Source-level first implementation for Belle Isle Explorer, Swoop Detroit and Elmwood Explorer. Keeps each Three.js WebGL2 game, controls, collision, probes and performance governor intact. Branch target: upgrade-redesign, not production.

## What is implemented

- Shared date/hour solar direction in east/north/up; rotates into the existing Belle Isle/Elmwood and Swoop Detroit world axes.
- Testable reference lighting, PBR texture role and source-rights/hash validation, planar/SSR/volume capability budget, smooth LOD weights and frame-time sampling.
- A **comparison-only** fixed solar date (2026-09-15) for Belle Isle and Swoop Detroit can be enabled with the ?gds-photo query parameter. Default lighting remains unchanged. Elmwood retains its existing solar date picker while reusing geographic math.
- No replacement Three renderer, heavy GPU pass, photogrammetry claim, navmesh merge, shipping texture change or new world connection.

## Stage gates

1. Material/lighting: inspect actual source maps, capture source/license/sha256, verify color-space roles (base albedo sRGB, normal/ORM data linear), compare identical date/hour/weather captures on Belle bridge, Swoop waterfront, Elmwood gate. No fabricated scanned maps.
2. Shared renderer: after a measured browser baseline, install ONE real near-water reflection tile only in opt-in cinematic desktop (1024px maximum, 12 Hz target). The current budget helper alone does NOT create a Reflector. Preserve PMREM probes and river shaders; volumetric and SSR similarly require actual pass integration. Treat LOD fading as per-object alpha/dither work; .dithering alone is not a geometry transition.
3. Performance/film: desktop 60 FPS and mobile 30 FPS are targets, not verified results. Measure CPU/GPU time, p95 frame time, frame hitching, GL memory, cold-start assets, request errors and 10-minute continuous play. Test 320×568 and 390×844 phone layouts, split-screen and XR. Apply LUT only after stabilization and color-space verification.

## Validation

Run npm test and npm run check from this folder. Then run the full parent game build/test suites and browser screenshot review before enabling the comparison mode by default or releasing.

## Explicitly not done

No production merge or deployment. Not a single shared runtime/physics world. No physically aligned road/NavMesh seams; those belong to the separate Greater Detroit world-integration effort. No installed ray-traced GI or hardware tessellation in WebGL2. No mobile GPU performance claim.
