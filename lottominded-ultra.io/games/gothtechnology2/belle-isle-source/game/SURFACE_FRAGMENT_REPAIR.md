# Surface fragment repair — investigation and acceptance

Version 1 · 26 November 2026

**Status:** three opt-in shader candidates are implemented. They are disabled in normal game construction. Appearance equivalence, runtime benefit, and release acceptance have not been established by the source tests.

The immutable comparison baseline is [PR #225 source d4f4baa8e2016f4c9107b40176388bf2d3f6fe8c](https://github.com/robjasper2084/Jungle-Lotto/commit/d4f4baa8e2016f4c9107b40176388bf2d3f6fe8c). No terrain surface, texture, geometry, collision, shadow, resolution, or quality reduction is part of this repair.

## Why these surfaces

[PR #238](https://github.com/robjasper2084/Jungle-Lotto/pull/238) publishes software-renderer attribution from [run 45851975232](https://github.com/robjasper2084/Jungle-Lotto/actions/runs/45851975232). Its diagnostic head is `e534445d8dea31f8ecd625f32a53fe7846a7e80b`; the observed original application source is `75906273c0cd414c0d004320fc6f654b4783e5b1`, rather than the current comparison baseline. The figures below reproduce that published report; this repair has not independently reproduced its runtime measurements.

The report identifies ANGLE Vulkan SwiftShader, Chrome 158.0.8127.88, 1280×800/DPR1, reduced motion, and Smooth/30 settings. Each of three observed frames submitted 363 draws, 1,028,834 triangles, and four lines. CPU render submission took 14.0–22.5 ms; the sum of sequential direct-call elapsed queries was 8,057.3–8,184.5 ms.

| Submitted surface/material | Triangles per frame | Published elapsed-query range |
| --- | ---: | ---: |
| Near Graded bridge approach / Park lawn | 2,560 | 1,750.7–1,815.5 ms |
| Joined island pavement / asphalt | 31,201 | 1,227.1–1,328.3 ms |
| MacArthur warm limestone / MacArthur masonry | 47,664 | 722.2–740.3 ms |
| Detroit mainland / Park lawn | 663 | 479.2–532.8 ms |

These scopes identify expensive submitted surfaces. They do not separate texture sampling, lighting, shader arithmetic, and covered-fragment cost. Instrumented query sums are neither an uninstrumented frame benchmark nor evidence about native Metal performance.

## Confirmed source findings and candidates

| Area | Source finding | Opt-in candidate |
| --- | --- | --- |
| Grass | `cinematicPolicy.ts` calculates the grain sine hash even when its derivative filter produces an exact zero contribution. | `new CinematicTerrain(scene, {skipInvisibleGrain:true})` hashes only when `belleLawnResolved > 0`. It retains the original patch/color expressions and their order; derivatives remain unconditional. |
| Asphalt | `asphaltPolish.ts` computes repair-cell shape work for fragments whose distance filter or cell-selection mask is zero. | `finishAsphalt(material, {skipInvisiblePatches:true})` skips filtered-out repair work and unselected cells. World-space coordinates, visible repair expressions, and the existing surface finish remain. |
| MacArthur materials | `bridgeMaterialFinish.ts` calculates grain even when its derivative weight is zero. | `finishBridgeMaterial(material, kind, {skipInvisibleGrain:true})`, also forwarded by `finishMacArthurConcrete`, guards the grain hash at an exact zero weight. Existing PBR and weathering expressions remain. |

All options default to false and have separate program-cache identities. No epsilon, resolution change, new texture, or approximation is introduced. Mathematical zero-contribution reasoning is a candidate justification, not a substitute for compiled pixel equality or measured improvement.

`parkLawn.ts` extracts the original base grass hook for use by the proof fixture and `world.ts`. A comparison against the pinned baseline found its callback source, cache identity, and generated shader strings exactly equal. Existing three-sine meadow variation and two-sine patch variation remain.

### Overlapping terrain

`shore.ts` constructs two 76-meter-wide, 40×32-cell approach grids at `terrain.height + .006`, each containing 2,560 triangles. `detroitScene.ts` supplies flat mainland lawn at y=2; `world.ts` supplies flat island lawn. Both approach grids use Park lawn and retain render order 0, as does the mainland; ordinary ground added in `world.ts` uses -102.

Sampling every cell center found all 1,280 mainland-approach centers above Detroit flat lawn and all 1,280 island-approach centers above island flat lawn. Sampled raised heights were 2.006012–6.004141 m and 2.006012–6.311871 m respectively. This demonstrates overlapping coverage at those samples. It does not prove full triangle containment, visibility from every camera, or that either surface can be removed or reordered without changing pixels. Surface removal and render-order changes are therefore not implemented. Any later overlap repair must include grazing views, ramp boundaries, and below-ramp/underpass views.

## Required appearance proof

The targeted proof must use independently loaded original source from the immutable baseline, not merely the candidate code with its option disabled. Record both source commits, source/asset hashes, browser version, actual renderer, viewport, and DPR. Validate served assets against the baseline.

Compare the original, current default, and enabled candidate in the same browser/GPU context with identical cameras, lighting, uniforms, textures, geometry, resolution, and deterministic state. Use actual material composition and authored surface geometry, including texture decorators and shadows. Repeated baseline captures must establish determinism before comparing a candidate.

Acceptance requires **zero changed RGBA pixels and zero channel tolerance**, with no ignored regions or substituted screenshots. Require working visible-material and shadow positive controls, unchanged geometry/material/texture/shadow receipts, and no missing assets or shader errors. Preserve baseline, candidate, and difference images with machine-readable results. Coverage must exercise visible detail, fully filtered detail, transition distances, grazing surfaces, relevant day/night lighting, and all four retained art looks.

Run the comparison separately on native Metal and SwiftShader, checking the reported backend. A targeted pass applies only to its recorded cases. It does not establish physical iPad behavior or complete full-scene visual acceptance. Any pixel mismatch keeps the candidate disabled; weakening tolerance does not satisfy this gate.

## Validation and remaining release gates

Focused source/composition tests currently pass **33/33**, covering asphalt, bridge/MacArthur composition, lawn selection/cloning/restoration, and existing cinematic contracts. These tests do not establish rendered equality or speed gain.

Before enabling a candidate, require its strict appearance proof and controlled timing evidence on the same source/build and renderer. Report unsupported or disjoint timer queries as unavailable. A faster diagnostic alone does not close any original release requirement.

The original full-game gates remain unchanged: exact-source typecheck/tests/build, complete feature visual and input checks, and the native 90-second sustained profile at p95 ≤50 ms with zero eligible intervals above 250 ms. Preserve the original desktop controls, all native inputs/assertions, and the 32-minute case deadline. Preserve the four art looks, optional bridge behavior, geometry, textures, shadows, resolution, and collision physics. Full acceptance must precede merge and deployment.
