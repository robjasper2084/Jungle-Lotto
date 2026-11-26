# Surface fragment repair — investigation and acceptance

Version 1 · 26 November 2026

**Status:** surface shader candidates are staged behind explicit opt-ins and remain disabled in normal game construction. A recorded SwiftShader run passed all 36 original-versus-candidate grain/patch cases with zero changed pixels. Its small timing sample did not demonstrate a reliable performance improvement. A subsequent MacArthur texture-sample candidate, native Metal, the added original-versus-current-default comparison, and full release acceptance remain unproven by that run.

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
| MacArthur mapped bump | The final warm-limestone material retains the exact same texture object for its color map and bump map. Stock Three samples the same center texel separately for each role. | `installMacArthurBumpCenterReuse(material, {enabled:true})`, installed only on an eligible final material, reuses the original raw color sample's red channel for the center height. Both offset bump samples, their derivatives, and the original multiplication/subtraction order remain. |

All options default to false and have separate program-cache identities. No epsilon, resolution change, new texture, or approximation is introduced. Mathematical zero-contribution reasoning is a candidate justification, not a substitute for compiled pixel equality or measured improvement.

`parkLawn.ts` extracts the original base grass hook for use by the proof fixture and `world.ts`. A comparison against the pinned baseline found its callback source, cache identity, and generated shader strings exactly equal. Existing three-sine meadow variation and two-sine patch variation remain.

The bump-center candidate is installed after the actual atmosphere, realistic-surface, photo, and sunset decorators. Its narrow contract requires the named MacArthur masonry material, identical ordinary color/bump texture, stock UV channel and sampling paths, and no normal-map alternative. It has an independent cache identity and checks its contract before compilation and drawing. The proof must observe the reuse in the linked native shader and a visibly effective wrong-center control; a helper that silently does nothing cannot pass. The newer fixture records three warmed ABBA timing groups per masonry view (six samples per variant); the grass and asphalt paths retain one group. No production construction calls this installer.

### Overlapping terrain

`shore.ts` constructs two 76-meter-wide, 40×32-cell approach grids at `terrain.height + .006`, each containing 2,560 triangles. `detroitScene.ts` supplies flat mainland lawn at y=2; `world.ts` supplies flat island lawn. Both approach grids use Park lawn and retain render order 0, as does the mainland; ordinary ground added in `world.ts` uses -102.

Sampling every cell center found all 1,280 mainland-approach centers above Detroit flat lawn and all 1,280 island-approach centers above island flat lawn. Sampled raised heights were 2.006012–6.004141 m and 2.006012–6.311871 m respectively. This demonstrates overlapping coverage at those samples. It does not prove full triangle containment, visibility from every camera, or that either surface can be removed or reordered without changing pixels. Surface removal and render-order changes are therefore not implemented. Any later overlap repair must include grazing views, ramp boundaries, and below-ramp/underpass views.

## Required appearance proof

The targeted proof must use independently loaded original source from the immutable baseline, not merely the candidate code with its option disabled. Record both source commits, source/asset hashes, browser version, actual renderer, viewport, and DPR. Validate served assets against the baseline.

Compare the original, current default, and enabled candidate in the same browser/GPU context with identical cameras, lighting, uniforms, textures, geometry, resolution, and deterministic state. Use actual material composition and authored surface geometry, including texture decorators and shadows. Repeated baseline captures must establish determinism before comparing a candidate.

Acceptance requires **zero changed RGBA pixels and zero channel tolerance**, with no ignored regions or substituted screenshots. Require working visible-material and shadow positive controls, unchanged geometry/material/texture/shadow receipts, and no missing assets or shader errors. Preserve baseline, candidate, and difference images with machine-readable results. Coverage must exercise visible detail, fully filtered detail, transition distances, grazing surfaces, relevant day/night lighting, and all four retained art looks.

Run the comparison separately on native Metal and SwiftShader, checking the reported backend. A targeted pass applies only to its recorded cases. It does not establish physical iPad behavior or complete full-scene visual acceptance. Any pixel mismatch keeps the candidate disabled; weakening tolerance does not satisfy this gate.

## Recorded GPU evidence

[Run 45867870864](https://github.com/robjasper2084/Jungle-Lotto/actions/runs/45867870864), source [`db28ef869aa0bd6fd32e54684fd39e9c1db466cb`](https://github.com/robjasper2084/Jungle-Lotto/commit/db28ef869aa0bd6fd32e54684fd39e9c1db466cb), passed the Linux proof against the pinned original. The actual backend was ANGLE Vulkan SwiftShader, Three r185, at 960×600/DPR1 with antialiasing. All 36 original-versus-enabled-candidate comparisons had zero changed RGBA pixels and zero maximum channel delta. Repeat-baseline, shadow, draw-order, submitted-geometry, visible-subject, effective-detail, and shadow controls also passed. This was a two-lane run; it does not certify the subsequently added current-default lane. The macOS job was still queued when this evidence was recorded on 26 November 2026.

The [Linux artifact](https://github.com/robjasper2084/Jungle-Lotto/actions/runs/45867870864/artifacts/15141213646) contains 96 PNGs, compiled fixture code, source/asset receipts, and the machine-readable result. Its downloaded ZIP SHA-256 is `daeb9d4f068062f269c929c5923c1f218992caa913786820cf325f9f4c2e28c5`.

Each timing case contains one warmed ABBA group: two original and two candidate elapsed queries. These are complete targeted fixture renders, including shadow work and query overhead, rather than isolated arithmetic or full-game frame times. The mean candidate change was:

| Surface | Near | Mid | Grazing |
| --- | ---: | ---: | ---: |
| Grass | −1.46% | −0.15% | +1.81% |
| Asphalt | +2.18% | −0.58% | +0.65% |
| MacArthur masonry | −1.22% | +0.62% | +0.82% |

Negative values mean a shorter elapsed query; positive values mean longer. The mixed direction and small sample do not establish a speed benefit. The guarded work is mathematically inactive in part of the image, but a GPU compiler may execute branches differently and other material work may dominate. No candidate is enabled on this evidence.

The fixture uses the actual MacArthur mesh geometry and existing material classification. Its tiled bridge deck is an authored material outcome, not a replacement plane. The receiver box is an explicit shadow control. This targeted scene cannot certify the complete game's appearance, gameplay, or performance.

## Validation and remaining release gates

The initial **43 focused source/composition tests passed**, covering asphalt, bridge/MacArthur composition, lawn selection/cloning/restoration, existing cinematic contracts, and the actual atmosphere/material lifecycle checks. The bump-center candidate adds **eight passing contract tests**, now included in the same workflow and full suite. TypeScript checking and the Vite source compilation also pass; the compilation omits public-asset copying and does not certify full packaging. The complete code suite after adding the bump-center candidate finished with **1,791 passes, zero failures and three skips**; the asset validation suite added 11 passes (**1,802 passing tests total**). The final three-lane browser fixture also passes a separate strict TypeScript check. These tests do not establish rendered equality or speed gain.

Before enabling a candidate, require its strict appearance proof and controlled timing evidence on the same source/build and renderer. Report unsupported or disjoint timer queries as unavailable. A faster diagnostic alone does not close any original release requirement.

The original full-game gates remain unchanged: exact-source typecheck/tests/build, complete feature visual and input checks, and the native 90-second sustained profile at p95 ≤50 ms with zero eligible intervals above 250 ms. Preserve the original desktop controls, all native inputs/assertions, and the 32-minute case deadline. Preserve the four art looks, optional bridge behavior, geometry, textures, shadows, resolution, and collision physics. Full acceptance must precede merge and deployment.
