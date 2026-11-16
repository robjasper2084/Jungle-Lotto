# Belle Isle Explorer — Environmental Fidelity Pass (independent branch)

**Status:** Design/validation brief only; **no environmental code changes are implied by this document**.
**Source baseline:** `main` at `b9909f8b1064bafb5832f6de0101d47c2203c1df` (2026-11-15).
**Feature branch:** `feature/belle-environmental-fidelity-20261115`.
**Isolation:** PR #167 (Cinematic Performance Pass 2) remains separate. Do not merge it, cherry-pick from it, modify its branch, or deploy from this work without specific new authorization.

## Verified source baseline (not an absence-of-feature claim)
- The conservatory has a mapped layout and active interior/pond geometry in `game/src/belle/conservatory*.ts`; `greenhouseOpenLayout.test.ts` explicitly protects real glazing, beds, fountain, and navigation. It also prohibits the *rejected fictional west-garden maze*. Keep that distinction.
- `streetPlan.ts` generates curb runs with crossing/plaza gaps and `streetDetails.ts` extrudes chamfered curb profiles. The problem to solve is visibly **segmented/blocky presentation**, not a blanket assertion that there are no curbs.
- `world.ts` triangulates mapped road polylines; preserve source map corridors, road widths, grades, race routes, walkable space, and all collision/raycast behavior. Presentation-only curve smoothing must not rewrite driving physics.
- `volumetricSky.ts` already performs GPU volumetric-cloud rendering; `worldAtmosphere.ts` already adds fog/cloud shading and wind to specific rider meshes. Ground-level atmospheric depth and **foliage** response need separate controlled evaluation, not indiscriminate addition of expensive global effects.

## Proposed incremental implementation

### 1. Conservatory realism — visual layer only
Audit conservatory mesh/material names, screenshots, and actual visible sources before identifying any “anime” styling. If present, correct only non-architectural stylistic overlays, emissive treatments or exaggerated colors while keeping true conservatory framing, glass optics, visible plants, pond and accessibility/collision clearances. Compare daytime/sunset close-up and interior views. Do not add a fictional maze or alter `greenhouseBlocked`, `greenhouseRay`, room zones, or landmark triggers.

### 2. Natural road/path curves and intersections
Evaluate tessellation and joins for mapped bends, then generate adaptive visual-only interpolation from existing control points. Preserve endpoints at crossings, bridges and route junctions; use curvature/error thresholds and LOD to cap triangles. Avoid changing the authoritative map, physics, route checkpoints, or driver raycasts. Add continuity, UV, finite-mesh and junction-clearance regression tests. Compare against original road geometry at identical camera poses.

### 3. Curb coverage and profile refinement
Audit the existing 15 cm curb segments and crossing gaps. Improve continuity at roads and sidewalk edges via render geometry, not by closing pedestrian crossings, plazas or beach approaches. Keep existing road identifier clearance checks, bridge grade transitions and curb ramps. Preserve `streetPlan.test.ts` assertions; expand them rather than reducing tolerances.

### 4. Atmospheric air, shafts, and foliage wind
First use existing cloud/height-fog and quality switches; tune depth/haze against real game captures. If light shafts are needed, introduce camera/scene-bounded, quality-gated scattering or low-cost impostor shafts (desktop high only) rather than default full-screen ray marching. Add wind to selected appropriate foliage only, with vertex-only motion, synchronized depth/shadow passes and stable bounding boxes. Never sway structures or alter collision. Disable wind animation for reduced-motion settings and provide an inexpensive mobile/Smooth fallback.

## Release gates (independent of PR #167)
1. Review **baseline screenshots** of greenhouse exterior/interior, two curved-road bends, one junction, crossing ramp, shoreline haze and foliage at daytime + sunset; record shortcomings and pass/fail references.
2. Each visual change requires a focused source test proving unchanged road/collision/safety logic, no lost glass/landmarks, finite geometry and bounded draw/triangle costs.
3. In `game/`: `npm ci`, `npm run check`, `npm test`, `npm run build`. Run the applicable repository-level release checks without weakening assertions.
4. Compare identical routes/device settings: startup assets, p50/p95/p99 frame time, memory, draw calls, shadow casters and WebGL errors. Test real Chromium desktop and phone layouts, including 390×340 and 320×568; validate ride/race, greenhouse, pedestrian crossing, controls and no freezes.
5. Attach before/after captures and exact head SHA to a **draft** PR targeting `main`. Do not mark ready until functional and visual reviews pass. A passing CI badge alone is not visual acceptance.
6. **No merge, main-branch Pages push, or claim of production availability** until a subsequent explicit approval; production verification still uses the separate published-version workflow for the exact deployed SHA.

## Initial scope boundary
This first commit is an isolation/validation handoff only. No runtime assets, physics, routes, shader code, tests, workflows, or published files have been changed.
