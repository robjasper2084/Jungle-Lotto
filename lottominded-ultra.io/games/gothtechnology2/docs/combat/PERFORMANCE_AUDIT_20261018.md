# Gameplay stutter audit — 18 October 2026

## Result
Local Swoop gameplay dropped to 50–54 FPS near the Cut, with a rolling 95th-percentile frame interval of 33.3–33.4 ms. A consistent 60 FPS needs frames within roughly 16.7 ms. Rendering/scenery and character work both consume significant time; disabling shadows alone did not restore consistent frame pacing.

This was an audit, not a performance fix or production deployment. No gameplay code was changed. Original Automatic graphics and preset shadows were restored.

## Method and scope
- Current local build: `http://127.0.0.1:8261/`; checkout `_game_merge_20261017`, branch `upgrade-redesign`.
- Windows, Chromium-based in-app browser, NVIDIA GeForce RTX 3080.
- Swoop viewport 1280×720 CSS pixels; backing canvas 1920×1080; fixed HD, pixel ratio 1.5, 60 FPS target, 2048px shadows.
- Swoop: fresh startup, Adelaide mural, then Chestnut start toward Antietam/Gratiot. The straight input eventually left the curving path and triggered an ordinary in-game collision. Slower frame samples persisted at that stopped location; this was not a browser freeze.
- Static Royale: single-rider practice range, stationary normal play and camera recording, plus a short walk. These spot checks do not represent a ten-player battle.
- Existing diagnostic counters were read through the DOM. Swoop CPU stage markers are cumulative; individual stage durations below use differences. They are sampled CPU times, not GPU timer queries.
- Other user game tabs remained open. No physical iPad test, cold-network test, long soak test, crowd-disabled comparison, or exact production release comparison was performed.

## Measured evidence
| Scenario | FPS | Frame interval p95 | Draw calls | Triangles |
| --- | ---: | ---: | ---: | ---: |
| Royale, normal stationary practice | 60.0 | 16.8 ms | 648 | 1.52 million |
| Royale, recording at same position | 60.0 | 16.8 ms | 542–648 | 1.14–1.52 million |
| Swoop, moving near Antietam | 60.0 | 16.8 ms | 908 | 2.01 million |
| Swoop, subsequent stopped collision location | 50.2–54.2 | 33.3–33.4 ms | 871–1,186 | 1.39–1.99 million |
| Swoop, same stopped position, shadows off | 56.1 | 33.3 ms | 930 | 1.40 million |

Shadows-off was a directional comparison, not a perfectly identical scene: crowds and scene content continued moving. FPS is a short window and p95 a rolling window; they describe different intervals.

Swoop first-playable diagnostic: **15.7 seconds** on localhost; startup UI reported 16.5 seconds. Scenery construction accounted for **11.2 seconds** of the recorded load stages. Named stages included city 2.2 s, street furniture 2.6 s, grass 0.9 s, and riders 1.1 s. Named timings can nest; do not sum them as independent time.

Browser-reported JavaScript heap in the route samples: **about 836–907 MiB**. This is not a GPU-memory measurement or proof of a leak, and browser process/context accounting may include shared resources. Geometry objects rose as the route populated, then stabilized at 1,787 during the stopped samples; texture counts were about 210. No console errors/warnings were captured in the inspected local Swoop log.

## Findings and fix order
### 1. High priority: reduce scene submissions and animated character cost together
The busy Swoop samples used 15.2–16.1 ms of measured CPU frame work, already close to a 60 FPS budget before unmeasured browser work. Scenery-update/render work took approximately 6.8–9.0 ms; the actors stage took about 4.9–5.3 ms in those samples. The moving sample had roughly 5.7 ms of simulation work, 2.0 ms actors, and 7.1 ms scene/render work.

A camera-visible census counted a nearby cyclist pack at 205 submissions and about 201,000 triangles. Multiple scenery groups also had dozens of submissions, and the armored hero alone counted 56 submissions / 62,413 triangles. Census values estimate camera-visible main-pass submissions and exclude shadow-pass cost.

Next changes: instance repeated furniture/vegetation, merge compatible static materials, simplify distant building/plant geometry and cyclist rigs, and reduce material splits on characters. Preserve the moving population. Existing traffic pooling and distant-animation throttling already exist in `swoop-source/src/detroit/actors.ts:258`; extend and measure them rather than assuming they are absent.

### 2. High priority: reduce initial scenery work and memory peaks
A 15.7-second local load and large reported heap warrant staged nearby scenery construction, stricter asset residency, and smaller mobile models/textures before more scenery. Profile cold iPad loading and a multi-minute Cut ride after changes. Desktop figures cannot establish the cause of the reported iPad reloads.

Source already budgets mobile textures in `compressedGLTFLoader.ts` and `renderBudget.ts`. Do not repeat the old assumption that all full-resolution texture originals are retained on mobile.

### 3. Medium priority: avoid whole-scene work during adaptive quality changes
`swoop-source/src/detroit/graphicsQuality.ts:54–64` traverses scene materials/textures and lights when applying quality. `setAdaptiveDetail` invokes that path. This is a concrete expensive-work candidate during automatic quality changes, but its stall duration was not isolated in this audit. Cache unchanged texture/material settings and change resolution/distance independently when possible.

The preset named Smooth targets 30 FPS by default; the separate Smooth 60 button requests 60. Neither is a guarantee under an overloaded scene.

### 4. Medium priority: trim routine allocations and improve diagnostics
Royale updates extensive HUD text/datasets each render. Replay capture clones snapshots before discarding loot/results in `royale/deathReplay.ts`. These are allocation candidates, not proven dominant causes here. Sample CPU/GC during a ten-player battle before prioritizing them over the measured rendering cost.

Royale FPS telemetry also includes time spent with a hidden tab in the first resumed reporting window. Ignore that first window and reset measurement counters on visibility changes; an initial sub-1 FPS reading was excluded for this reason.

### 5. Recording is not yet implicated by the desktop check
The new capture path only copies the game canvas for a photo or active recording (`royale/cameraCapture.ts:36–39`); video copies are capped at 24 Hz. Normal play has no ongoing capture copy. Recording held 60 FPS in this desktop practice test. The WebGL-to-2D copy/encoder still needs separate testing on the iPad.

## Outstanding acceptance checks
- Fixed route, fixed quality, crowd-on/off comparison with per-stage timings and frame-time maxima.
- Ten-player Royale combat and effects profiling.
- Elmwood route profiling; no fresh Elmwood runtime measurement is claimed here.
- Real 2020 iPad Pro/Chrome: cold load, curbs, Cut ride of at least five minutes, recording on/off, memory/context-loss symptoms.
- Target p95 at or below 16.7 ms for the intended 60 FPS preset; report stalls and visual quality, not just an average FPS.
- Repeat against the intended public release after optimization.

## Evidence
Raw route samples: [route-samples.json](C:/Users/digit/Documents/phone/output/performance-audit-20261018/route-samples.json).

- `C:/Users/digit/Documents/phone/output/performance-audit-20261018/route-samples.json`
- `C:/Users/digit/Documents/phone/output/performance-audit-20261018/scene-evidence.json`
- `C:/Users/digit/Documents/phone/output/performance-audit-20261018/route-scene.png`

