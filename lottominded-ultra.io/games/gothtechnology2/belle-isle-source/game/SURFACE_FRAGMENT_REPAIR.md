# Surface fragment repair — investigation and acceptance

Version 2 · 26 November 2026

**Status:** the grass candidate is withdrawn because native Metal changed 23 pixels across nine cases at maximum channel delta 1. The original terrain shader is restored byte-for-byte. Asphalt and MacArthur candidates remain disabled in normal game construction: their strict targeted pixels passed on both backends, but their timings do not establish a consistent native improvement. The unchanged full-game desktop release checks remain failing on the original source; merge and deployment are blocked until the final revision passes them.

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
| Grass | `cinematicPolicy.ts` calculates the grain sine hash even when its derivative filter produces an exact zero contribution. | **Withdrawn.** A conditional hash produced one-channel rounding differences on native Metal. The option and helper are removed; `cinematicTerrain.ts` is the exact original source. The lawn remains in all 12 fixture cases as an unmodified regression control. |
| Asphalt | `asphaltPolish.ts` computes repair-cell shape work for fragments whose distance filter or cell-selection mask is zero. | `finishAsphalt(material, {skipInvisiblePatches:true})` skips filtered-out repair work and unselected cells. World-space coordinates, visible repair expressions, and the existing surface finish remain. |
| MacArthur materials | `bridgeMaterialFinish.ts` calculates grain even when its derivative weight is zero. | `finishBridgeMaterial(material, kind, {skipInvisibleGrain:true})`, also forwarded by `finishMacArthurConcrete`, guards the grain hash at an exact zero weight. Existing PBR and weathering expressions remain. |
| MacArthur mapped bump | The final warm-limestone material retains the exact same texture object for its color map and bump map. Stock Three samples the same center texel separately for each role. | `installMacArthurBumpCenterReuse(material, {enabled:true})`, installed only on an eligible final material, reuses the original raw color sample's red channel for the center height. Both offset bump samples, their derivatives, and the original multiplication/subtraction order remain. |

The remaining options default to false and have separate program-cache identities. No epsilon, resolution change, new texture, or approximation is introduced. Mathematical zero-contribution reasoning is a candidate justification, not a substitute for compiled pixel equality or measured improvement.

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

[Run 45871891749](https://github.com/robjasper2084/Jungle-Lotto/actions/runs/45871891749), source [`d0f6154705cb24dff174b245c573c17919ed4a24`](https://github.com/robjasper2084/Jungle-Lotto/commit/d0f6154705cb24dff174b245c573c17919ed4a24), completed all 36 three-lane comparisons on both backends at 960×600/DPR1. The Linux job passed. The macOS job failed the original zero-tolerance assertion because the enabled grass candidate changed pixels.

| Comparison against pinned original | SwiftShader | Native Metal |
| --- | --- | --- |
| Current default, all surfaces | 36/36 exact | 36/36 exact |
| Enabled grass candidate | 12/12 exact | 3/12 exact; 23 changed pixels in the other nine captures |
| Enabled asphalt candidate | 12/12 exact | 12/12 exact |
| Enabled MacArthur grain and mapped bump-center candidate | 12/12 exact | 12/12 exact |

Maximum grass channel difference was 1. No error tolerance, mask, ignored region or baseline update is accepted. The candidate was removed instead. Grass fixture metadata now explicitly records withdrawal and unchanged shaders, and the independent source check requires the current terrain implementation to equal the original.

Baseline repeat, current-default, shadow, draw-order and submitted-geometry comparisons were exact on both platforms. Actual linked/submitted bump-center shader markers were present. The wrong-center positive control changed 373,180 pixels on SwiftShader and 372,876 on Metal; restoring the original value restored zero-difference pixels. Both backends passed the asset and shader error checks.

The [SwiftShader artifact](https://github.com/robjasper2084/Jungle-Lotto/actions/runs/45871891749/artifacts/15142939591) ZIP SHA-256 is `976ed04889366d8bd2827041b5bb7bf399bcbfb3b50ce2f0075ef75403dc41d0`. The [Metal artifact](https://github.com/robjasper2084/Jungle-Lotto/actions/runs/45871891749/artifacts/15143721491) ZIP SHA-256 is `0f57f2c8bc3dc95f85172e6d9d08e03a88eea7209f241119df0d7641c2e92689`. Every expected original/default/candidate capture is independently required and hashed.

The masonry candidate uses three warmed ABBA groups per view, giving six observations per lane. The recorded native elapsed-query results are:

| Masonry view | Original mean | Candidate mean | Mean change |
| --- | ---: | ---: | ---: |
| Near | 3.640 ms | 3.339 ms | −8.26% |
| Mid | 2.543 ms | 2.578 ms | +1.38% |
| Grazing | 3.122 ms | 3.129 ms | +0.21% |

Near-view samples contain large outliers; their medians are 2.631 and 2.585 ms, only −1.77%. The other views have mixed results. These full targeted fixture queries include shadows and instrumentation overhead, and combine grain skipping with bump-center reuse. They do not demonstrate a consistent native rendering improvement or isolate one instruction's cost. Asphalt has only two samples per lane per view and similarly mixed results, so it also remains disabled. Fence-wait measurements include polling/scheduling and must not be described as GPU elapsed time.

The prior Linux-only result in [run 45867870864](https://github.com/robjasper2084/Jungle-Lotto/actions/runs/45867870864), source `db28ef869aa0bd6fd32e54684fd39e9c1db466cb`, is historical two-lane evidence. Its macOS job was superseded by the later revision; it does not establish a native pass.

The fixture uses actual MacArthur geometry and existing material classification. Its tiled bridge deck is an authored material outcome. The receiver box is an explicit shadow control. This targeted scene cannot certify the complete game's appearance, gameplay or sustained performance.

### Withdrawal verification

[Run 45894166838](https://github.com/robjasper2084/Jungle-Lotto/actions/runs/45894166838), source [`c1a4ce4de582f06834c06d11ab4fed69855cd23b`](https://github.com/robjasper2084/Jungle-Lotto/commit/c1a4ce4de582f06834c06d11ab4fed69855cd23b), passed all 36 cases on both native Metal and SwiftShader after the grass candidate was removed. Original/default/candidate comparisons, repeats, controls, geometry and order all passed with zero RGBA tolerance. Lawn rows explicitly report `optimizationApplied:false`; the candidate slot is original lawn regression coverage. This repairs the failed appearance gate without claiming a grass speed improvement.

The Metal artifact is `15153341053`, ZIP SHA-256 `520c058bdf9158fd7787272db8beaa41f49c069d367995378719a236f316d1f6`; the SwiftShader artifact is `15152748237`, ZIP SHA-256 `257f0906353d02cf6526df1df25eb84c8d1d8b76e8cf0aaaf1485bfe26a98617`. The 47 retained focused tests passed on both platforms. A separate Metal artifact audit decoded every required capture and confirmed all 72 original-versus-default/candidate pairs were exact; all 135 encoded capture hashes matched.

The subsequent source `7ec17530cd763361484aba172e9e28917c75c4e2` persists the original lawn callback/cache/shader equality checks and a whole-file production-world assertion allowing only the exact original hook extraction. Both native Metal and SwiftShader jobs passed those stronger guards and the 47 focused tests in [run 45896123069](https://github.com/robjasper2084/Jungle-Lotto/actions/runs/45896123069). These later assertions are not attributed to the earlier c1 run.

### Native CPU investigation

[Diagnostic run 45887564199](https://github.com/robjasper2084/Jungle-Lotto/actions/runs/45887564199) built exact original source `d4f4baa8e2016f4c9107b40176388bf2d3f6fe8c` through the workflow-only [PR #241](https://github.com/robjasper2084/Jungle-Lotto/pull/241). Both diagnostic jobs completed, but both underlying ride reports remained failing. Their separate hosts, observer overhead and derived manual-profile driver make them attribution evidence only, not a controlled speed comparison or release acceptance.

The observed window had zero shader compile/link/status calls. Inclusive direct-draw submission and matrix work were much larger CPU scopes than texture/buffer upload or raw GL draw calls. Older native CPU samples also concentrate work in program/material preparation and uniform upload, but those application revisions contain other experimental changes and their absolute timings are not current-source estimates. This motivates a controlled CPU submission candidate; it does not establish one as effective.

### Separate CPU experiment

The new shared-geometry diagnostic constructs one immutable original `createWorld` scene and alternates the original pooling hooks, native geometry submission, pooling with the opt-in named uniform cache, and native submission with that cache. It retains the actual original materials, meshes, shaders and framebuffer. The pool is prepared once; candidate timing does not include preparation or disable/recreate cycles. Recorded pool substitutions and native geometry identities establish which path actually ran.

The cache candidate preserves Three's original array conversion and skips a captured upload only when the eligible Float32 payload, uniform location and context method are identical. Its four original targets are directional shadow matrices and the three named water arrays. Twenty-nine contract tests cover mutation, exact values including signed zero, exceptions, context transitions, native evaluation order, disposal and diagnostic accounting. No production code installs this helper.

The first runtime experiment is explicitly bounded to three frozen original-world views and Authentic day/night. It records strict RGBA, source geometry and native draw order, linked shader receipts, effective source/shadow controls and a live shadow-uniform update. It records eight native ABBA groups for each candidate, separately for forced-shadow and daytime color-only rendering, with CPU submission and true GPU elapsed time. Fence waits and skipped-upload counts are not speed metrics. Other art styles, optional bridge coverage and live water-uniform mutation require further proof if a candidate is selected. This experiment does not replace the original riding, input, visual or release gates.

The native experiment at source `7ec17530cd763361484aba172e9e28917c75c4e2` completed all six views and 27 timing comparisons in [run 45896123413](https://github.com/robjasper2084/Jungle-Lotto/actions/runs/45896123413). Independent decoding verified all 66 saved PNGs, all required exact comparisons, changed-light controls, source geometry, submitted draw order and linked shaders. The browser result passed, but the Node report validator failed because its expected coverage object omitted the two actual pooled color/shadow substitution counts. The correction independently recomputes and requires both counts; it does not remove the assertion. The original failed report remains the record of that run. Its Linux job exceeded the unchanged 35-minute diagnostic limit before returning captures, so it has no completed software result. The diagnostic now partitions Linux into two fixed three-case jobs while retaining all six cases, all 66 PNGs, every per-case control/warm-up and the same deadline. The second partition replays preceding world updates and their original warm-up to retain visibility/caster state. Native remains one complete six-case run; the workflow matrix and complete case union are independently checked.

No CPU candidate is selected. Removing pooling, adding the wrapper cache, and combining the two produced gains in some views and regressions in others. Paired bootstrap analysis of the retained eight ABBA groups found a native no-pool island-day GPU regression of +0.945 ms, with a 95% interval of +0.303 to +1.517 ms; the pooled-cache Conservatory-night GPU regression was +3.384 ms, with an interval of +0.800 to +6.058 ms. The skipped-upload counters establish exercised work, not an application speed improvement. Production retains its original pool and does not install the wrapper cache.

### Asphalt depth-pass evidence

The separate [PR #242](https://github.com/robjasper2084/Jungle-Lotto/pull/242) has a pixel-exact, explicitly factory-owned joined-pavement depth pass. Its native benefit [run 45894780429](https://github.com/robjasper2084/Jungle-Lotto/actions/runs/45894780429), source `bd7afa05bffbca68616f71c192a29338e721d95b`, does not establish a useful gain. Four of six full-fixture GPU means worsen, with significant paired regressions in the start-night and far-road-day views. Each added depth draw repeats 24,733–31,201 pavement triangles. This source is not ported or enabled here. Its isolated pavement/grass fixture does not certify the full game.

### Direct shadow-uniform experiment

The next candidate is separate from the failed wrapper. A source-hash-pinned build transformation adds a dedicated setter only for Three 0.185.1's `directionalShadowMatrix` array uniform. It retains original conversion before comparing the resulting Float32 payload and leaves other uniform setters unchanged. Cache eligibility requires the captured native WebGL2 method and ordinary unchanged descriptors; custom wrappers and accessors delegate every request. Thirty-four contract tests include the stock-vector reentry case that defeated a callable-wrapper cache. It is opt-in in the transformation API and is not inserted into the game build configuration. Installed dependencies and generated application bundles are not edited.

The new diagnostic uses the same immutable original world and prepared geometry pool for both arms. A proof-only controller switches actual eligible uniform nodes between the untouched original setter and the direct candidate before a lane. It requires exact pixels, unchanged draws/shaders, moved-light and restored-light uploads while the cache remains active, and invalidation when switching modes. Native timing retains every raw sample in eight ABBA groups, with 16 measured frames per lane after warm-up; CPU submission, GPU elapsed queries and fence waits remain separate. The initial six Authentic day/night cases are a usefulness experiment, not final four-look, optional-bridge or release acceptance.

## Validation and remaining release gates

The last pre-withdrawal revision passed **51 focused source/composition tests**, covering asphalt, bridge/MacArthur composition, lawn selection/cloning/restoration, existing cinematic contracts, actual atmosphere/material lifecycle checks and eight bump-center contract tests. Removing the rejected grass helper also removes its four candidate-only tests; all original cinematic and atmosphere contracts remain required. TypeScript checking and the Vite source compilation also pass; the compilation omits public-asset copying and does not certify full packaging. The complete code suite after adding the bump-center candidate finished with **1,791 passes, zero failures and three skips**; the asset validation suite added 11 passes (**1,802 passing tests total**). The final three-lane browser fixture also passes a separate strict TypeScript check. These tests do not establish rendered equality or speed gain.

Before enabling a candidate, require its strict appearance proof and controlled timing evidence on the same source/build and renderer. Report unsupported or disjoint timer queries as unavailable. A faster diagnostic alone does not close any original release requirement.

The original full-game gates remain unchanged: exact-source typecheck/tests/build, complete feature visual and input checks, and the native 90-second sustained profile at p95 ≤50 ms with zero eligible intervals above 250 ms. Preserve the original desktop controls, all native inputs/assertions, and the 32-minute case deadline. Preserve the four art looks, optional bridge behavior, geometry, textures, shadows, resolution, and collision physics. The original source failed the independent desktop native profile at p95 50.1 ms in [run 45849327061](https://github.com/robjasper2084/Jungle-Lotto/actions/runs/45849327061), and the four-art desktop strict profile at p95 66.6 ms in [run 45849327565](https://github.com/robjasper2084/Jungle-Lotto/actions/runs/45849327565). Both phone profiles passed. These failures remain binding until the final improved revision passes the same checks. Full acceptance must precede merge and deployment.
