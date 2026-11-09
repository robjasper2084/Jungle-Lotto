# Belle Isle: co-op integration and first-30-second stability

## Authorization and integration boundary

The user requested integrating the separate two-player co-op into main while preserving the recent canal repairs, investigating loading/first-30-second stalls, and supplying an optimization plan. This candidate starts from production `cd0684faf646050fbc541397aea664d4c8e07e50` (tree `3ca9dfdec029a2932c2957d6f4fb57b381ba181c`) and includes the exact co-op feature `79583b2cb29ff0df8566b1a1d55521255d232575` as a second integration parent. It is a new reviewed candidate, not a replacement SHA secretly inserted into PR139's old staging-only authorization. The original co-op and staging branches remain untouched.

Production was verified to contain the bridge repair and NOT co-op at investigation time. Therefore the reported current production stall cannot be a conflict between the new bridges and co-op. The combined candidate still needs independent regression and performance evidence; old passing statuses do not transfer automatically.

## Findings: measured versus suspected

### Measured local CPU work

Eight Node/Three CPU runs of the actual map and bridge builder were recorded. In the first cold run: structural planning 26.2ms, geometry generation 44.5ms, ParkTerrain construction 79.0ms. ParkTerrain includes its own planning, so these numbers must NOT be added together as three independent boot costs. Warm runs were lower. This shows a plausible short main-thread task, not proof that the bridges cause a thirty-second GPU stall. No browser GPU or physical-phone FPS was measured by that benchmark.

The staged bridge builder generates exactly the same vertex/index buffers and statistics as the original: 59 mapped pieces, 129 rail segments, 16,872 triangles and 50 world-wide material/tile batches. All bridge collision geometry and routes are retained. No claim of zero bridge draw cost is made.

### Source-confirmed startup hazards, not a completed causal GPU trace

- Surface preparation launched all 28 color/detail pairs together (56 texture requests) and did not explicitly upload the textures before their first material use.
- SceneWarmup compiled shader variants but did not explicitly initialize material/uniform textures.
- The dynamic sky probe calls synchronous PMREM `fromScene` during rendering; the first capture can replace the initial environment after gameplay has begun. This is a plausible first-use stall and shader/environment transition, not a measured sole root cause.
- Co-op allocates its model assets only when a session begins, not in its constructor. Its two views intentionally render the shared world twice; physical-device cost and per-view scenery-cache churn need separate profiling.

Primary API references: https://threejs.org/docs/pages/WebGLRenderer.html (`compileAsync`, `initTexture`) and https://threejs.org/docs/pages/PMREMGenerator.html. The official renderer documentation distinguishes shader preparation from initializing texture data before first use. No performance percentage is inferred from documentation.

## Implemented preparation changes

1. Limit surface loading to three pairs concurrently, retain the same texture files and settings, and explicitly warm each pair. The texture phase has bounded failure handling; rejected/late resources are cleaned instead of publishing a partial material set.
2. Warm material and shader-uniform textures before shader compilation under the existing loading lock. Cache uploads per renderer/texture version; skip render-target-owned textures. Yield between short upload batches. The existing SceneWarmup deadline and retry/cancellation contract are unchanged.
3. Prepare the first dynamic sky probe before the initial shader warmup and Ready handoff. Protect the first thirty seconds after solo or co-op starts, then require thirty consecutive eligible frames <=40ms before optional refresh. Keep the last valid probe/HDR fallback on slow rendering or failure. This is not disabling sky reflections or lowering their existing quality sizes.
4. Slice bridge geometry generation and final merges around a four-millisecond scheduling target, yield between other large boot groups, and add the complete bridge root atomically before gameplay. A single GPU call is not preemptible and the target is not a hard per-device frame guarantee.
5. Add local-only startup phase, long-task and early-frame diagnostics. `window.__belleStartupProfile()` returns snapshots for 0–5, 5–15 and 15–30 second windows: sample counts, median/p95/p99/worst frame times, >50ms/>250ms counts, CPU time, draw counts, textures, geometries and programs. Solo/co-op starts reset the window, and paused/background intervals are excluded. Co-op draw counts include both viewports. No network analytics, user data or save migration is added.

## Preserved behavior

The exact co-op actors/controllers/lobby and workflow are retained. Both original test suites remain registered, along with new startup tests. Local co-op still means same-device EUC exploration; online co-op transport, dual hoverbikes, Cadillac and extra vehicle rigs are not included. Bridge repair, crosswalk count, open-shelter pavement, race routes, checkpoints, saved records, music preferences, sky artwork and public-account/payment services remain unchanged. No existing CI assertion or timeout was weakened. No generated asset bundle was hand-edited.

## Evidence completed before pushing

- 67/67 focused Node tests passed with none skipped: new preparation/diagnostic tests plus existing SceneWarmup recovery, frame-budget, bridge and crossing regressions.
- Scoped strict TypeScript passed for all changed preparation/render modules and their dependencies, including the new tests.
- The modified main file was reconstructed from the exact approved co-op blob before applying the small startup/diagnostic additions. Every uploaded modified blob was matched to its locally tested bytes.
- Synchronous and staged bridge vertex/index buffers were compared and identical.

These are NOT a full combined application build, live WebGL screenshots, physical-phone/controller tests, sustained hardware FPS or a proven elimination of the user's reported stall. The combined complete source suite, actual game rendering, packaged-site tests and new branch-specific CI must all pass before main merge.

## Validation and next optimization plan

A. Compare production and this combined candidate on the SAME device, viewport, graphics preset, frame cap, camera route and cache condition. Run three cold starts and three warm starts for desktop and phone; test solo and local co-op separately. Record full startup time plus each early window, not just average FPS. Do not use multi-second SwiftShader screenshot timing as a physical-device certification.

B. Inspect long tasks, texture/program count growth and PMREM capture CPU time around the observed pauses. Distinguish download, image decode, GPU upload, shader compilation and first-use draw costs. Keep actual screenshots of both riders and repaired bridge crossings; never replace them with isolated DOM fixtures.

C. If stalls remain, profile destination-route precomputation, cloud texture generation, landmark/material creation and allocation/garbage collection before further edits. For split-screen, inspect the single-view vegetation and landmark selection caches when the two cameras separate; use dual-camera-aware caching only if measurements show churn. Do not remove streets or bridge rails as an unmeasured performance workaround.

D. Accept the integration only with unchanged functional gates (co-op, canal crossings, direct startup, polish, time trials and Pages package), no new rendering/asset failures, and reviewed early-frame data. State actual hardware limits; do not invent 30/60FPS guarantees. Merge through a guarded PR into the pinned production base, then verify the main-push deployment and public manifest separately.
