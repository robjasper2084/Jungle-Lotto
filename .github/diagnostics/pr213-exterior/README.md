# Additional native exterior evidence for PR 213

This diagnostic adds eight exterior views of the unchanged staged application at
`61a9db36df072850f4bcea4536471e3d92e07453`. It reuses the exact build artifact
`15149060140` from run `45882624790`, with ZIP SHA-256
`6d244cd0bf5c5564af1e4790bab5605493f887d4686eaa0640386b3d6eb80559`.
No application rebuild, scene edit, camera setter or synthetic DOM input occurs.

The additional mobile gallery is explicitly **844×390 landscape at Smooth/30**;
the desktop gallery is **1280×800 at High/60**. Existing portrait mobile evidence
remains **390×844** in the unchanged original fixtures. Landscape is needed to
fit the complete Conservatory without leaving the full-detail LOD0 distance.
The real Settings UI selects these modes and noon/clear sky through trusted
native label typeahead, and capture receipts require full pixel scale.

The original six matched comparison views, eight entrance/walk captures and
performance/control acceptance scripts remain byte-for-byte unchanged. This
fixture does not execute, replace, relax or approve those gates.

## Views and public controls

Each view starts independently with the existing Guide's **Travel to entrance**
or **Travel to path**, dismounts with F, and walks with native W. The Conservatory
south/east views start at the neighboring Aquarium entrance, avoiding an existing
narrow garden gate. Native A/D in
third-person mode changes heading; native V returns to first person. The routes
attempt Aquarium front, west side, rear and east oblique views, and Conservatory
west front, north wing, south wing and east/rear oblique views. Both buildings
are adjacent, so two endpoints deliberately use oblique angles.

Targets are desired walking waypoints, never position assignments. Fixed
intermediate targets split every planned line into at most 7.5-metre pieces,
with native re-aiming and at most 0.5-metre arrival tolerance. The initial path
preflight checks original terrain, known obstacles and shoreline; native movement
must still execute successfully. There is no automatic retreat into unplanned
terrain when framing fails. Actual
collision can block a route. The original failure remains in `report.errors`,
the failed pose and available image are retained separately, and other views
are attempted within the original 32-minute case budget. A failed image never
counts as a required view. No route failure is converted to success.

Each completed view records the actual actor trajectory, trusted input events,
the existing observer's submitted camera matrices and Float32 bit patterns,
six consecutive stationary passes, native renderer identity, GPU completion
fence and compositor PNG. The same camera must remain stationary across the PNG.
The two actual pinned LOD0 GLBs are parsed for every position vertex.
All 1,802 Aquarium vertices and 11,400 Conservatory vertices are projected using
the observed LOD0 world matrix and actual camera matrices; every vertex must fit
inside a conservative 92% frustum margin. Because the clipping planes form a
convex volume, their triangles also fit. The eight bounding-box corners remain
in the report separately: empty corners above low wings may lie outside even
when all actual geometry fits. The target must still select its full-detail LOD0.

**Framing is not an appearance or collision acceptance.** Vegetation or the
neighboring building may occlude a view even when the model bounds fit. Human
review of the native PNGs is still required for roof, wall, rear/side completeness,
ground contact, stairs and visual fidelity. Ground/step fit requires the separate
geometry evidence. `fullExteriorAccepted`, `collisionAccepted` and
`performanceAccepted` remain null.

## Reproducible execution

The workflow uses a separate exact-source checkout and a diagnostic checkout.
It verifies the original archive's metadata, SHA-256, every ZIP CRC, build marker
and index hash before extraction. `prepare-dist.mjs` requires
`PR213_EXTERIOR_ZIP`, `PR213_EXTERIOR_ARTIFACT_JSON`, `STAGED_LANDMARK_DIST` and
`STAGED_LANDMARK_OUT`.

With the original source checkout and verified extracted distribution available:

```sh
export STAGED_LANDMARK_GAME_DIR=/absolute/exact-source/lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game
export STAGED_LANDMARK_DIST=/absolute/verified-dist
export STAGED_LANDMARK_SOURCE_SHA=61a9db36df072850f4bcea4536471e3d92e07453
export STAGED_LANDMARK_OUT=/absolute/exterior-evidence
export PR213_EXTERIOR_GENERATED=/absolute/generated-diagnostic
node --test .github/diagnostics/pr213-exterior/contract.test.mjs
node .github/diagnostics/pr213-exterior/build-driver.mjs
STAGED_LANDMARK_RENDERER=metal STAGED_LANDMARK_LAYOUT=desktop \
  node "$PR213_EXTERIOR_GENERATED/exterior-driver.mjs"
```

The existing parent package's locked Playwright dependency and native Chrome
must be installed as in the original workflow. Metal requires macOS; an explicit
software run records SwiftShader honestly and cannot satisfy the native lane.
Use `STAGED_LANDMARK_LAYOUT=phone` for the explicitly labelled additional
landscape phone run. It does not create or claim a portrait capture.

Before each native run, `ground/audit-ground.mjs` measures the pinned shipped
meshes against the unchanged terrain and retained Conservatory paving. Its
separate JSON retains all sampled support offsets. A ground-audit failure remains
binding while the browser route is still allowed to collect its own images.
This CPU geometry audit does not change the actual scene or its collision.

`build-driver.mjs` first hashes five original source scripts, then applies unique,
exact-text transformations to a separate generated file. It preserves the
original startup, Guide, keyboard, focus, source/build checks, PNG helper and
cleanup. Only the generated route body and its route-specific assertions change.
Its provenance receipt includes all source hashes and the generated hash. Source
changes or ambiguous insertion anchors stop generation. Generated files belong
in temporary output and are not committed.
The output also retains the exact diagnostic commit/tree identity and copies of
the contract, extension, generator, tests, ground audit, documentation and workflow
with SHA-256 receipts. The native report binds itself to the generated driver's
hash. Both source checkouts disable persisted checkout credentials.

The contract tests validate source preservation and rejection, actual GLB vertices,
world/camera projection, independent public-input routes, and negative native
input cases. They are not a claim that a route has been executed. Runtime PNGs
and the full retained report are the execution evidence.

### Gallery-only native heading control

The first corrected gallery attempt at `f1f1aad1` reproduced the original turn
helper's oscillation. The frozen on-foot controller smooths yaw rate at 16/s
toward 2.7 rad/s and steps at 120 Hz. At full rate, native key release leaves
0.15775 rad of subsequent rotation. The original helper polls at 100 ms and
releases 0.08 rad before the target, so polling and retained angular motion can
overshoot the unchanged 0.15 rad final tolerance.

Only the additional gallery uses `exteriorTurnTo`: actual-frame polling, a
0.20 rad release lead, and six consecutive observed headings within 0.002 rad
after each release. It records every target, native pulse, release observation,
settled pose and remaining error. The same four-attempt limit, case deadlines,
native keyboard API, original application, original entrance driver, full-frame
camera checks and capture tolerances remain. It fails if native control still
does not settle or reach the target. This harness correction does not grant any
appearance, collision or performance acceptance.

## Concurrent exterior fixture at 8b33a583

This frozen-source diagnostic remains separate from the later
`8b33a58311d4beebefb7aa7f6b0dbd6e17715be7` exterior fixture. That fixture's
[planner](https://github.com/robjasper2084/Jungle-Lotto/blob/8b33a58311d4beebefb7aa7f6b0dbd6e17715be7/lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/scripts/staged-landmark-exterior-proof.mjs)
requires a camera distance based on the full-model world bounding sphere. At
390×844 and the source-defined 60-degree vertical FOV, the pinned meshes imply
minimum planned radii of **205.70 m for Aquarium** and **229.94 m for Conservatory**.
Both exceed the original 180-metre transition out of LOD0. Its capture call uses
`near:false`, and its exterior contract requires only one selected LOD, rather
than specifically `[0]`. The
[read-only exterior receipt](https://github.com/robjasper2084/Jungle-Lotto/blob/8b33a58311d4beebefb7aa7f6b0dbd6e17715be7/lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/src/belle/stagedLandmarkGroundFit.ts)
explicitly projects hidden LOD0 bounds while recording whichever LOD is selected.
Consequently those portrait images can provide distant context but cannot prove
the full-detail exterior is present in their pixels. These distances are source
and mesh calculations, not claimed native execution results.

The newer entrance branch retains its original eight captures and associated
passage/contact assertions. Its separate exterior path stops on the first route
or aiming failure, and records camera position/direction without the existing
submitted-camera comparison observer's stationary-pass and Float32 matrix guards.
This diagnostic preserves those guards and independent failures, while collecting
additional full-detail landscape views. Neither fixture grants visual acceptance
without reviewing the actual native images.
