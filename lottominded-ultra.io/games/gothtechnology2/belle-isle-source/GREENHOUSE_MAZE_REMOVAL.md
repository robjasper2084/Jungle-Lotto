# Greenhouse / garden maze exclusion

## Scope and provenance
Requested November 13, 2026. Base: `4a2b67d0b10beafb7c999f11985e45a4e45adb94`, tree `bdd7bbb02d85bf4022d0e4be85c1b20e87fabc14`. Work belongs to `feature/remove-maze`, never a direct main implementation commit.

The existing production layout has no greenhouse maze. The unmerged environment experiment proposed a fictional 7 by 5 hedge maze WEST of the Conservatory. That proposal is rejected for this branch. No diagnostic branch is merged and no speculative new maze is introduced.

The production greenhouse already has connected open aisles through five plant houses. Its shell, real plant beds, fountain and three pond-side rail/gate segments are not maze walls and remain unchanged. The production terrain, scene loader, main loop, nature selection, indoor sound classification, lighting, asset allowlists and every media byte are unchanged. There is no removed maze lightmap to rebake or maze dependency to unlink from the current production manifest. Unrelated Jackpot Maze remains untouched.

## Added regression coverage
- Reject the known draft maze modules, renderer/physics hooks, guide teleport and placement filters.
- Sweep 2,337 half-metre ground samples through the rejected garden footprint, plus ground/camera/flight rays.
- Walk directly across the former footprint in both directions using the real RideCore controller; enter all five greenhouse rooms and leave through the normal doorway without a reset or injected pose.
- Preserve solid glazing, beds and pond rail; retain room detection, indoor ambience attenuation, fountain proximity and pause muting.
- Read actual canonical GLB metadata and require shared Conservatory architecture, rejecting named maze geometry/materials. This is not a claim that names detect all unnamed geometry.
- Retain every existing test registration and add these tests. No release workflow, timeout, assertion, control-size minimum or artifact cap is relaxed.

## Rendering and release status
Relative to current production, runtime and asset changes are ZERO. Therefore no draw-call, triangle, CPU, GPU or FPS reduction is claimed. The discarded experiment described three static maze batches; that authoring count is not a measured performance delta. A real with-maze comparison would require the unmerged experiment and a matched camera/quality/season/time view, with actual WebGL captures and frame statistics. Do not manufacture such evidence from unit tests.

Before deployment, all seven unchanged release workflows must pass on the exact PR head/tested merge: Pages build, time-trial, release-evidence, direct startup, co-op, polish and canal. Inspect desktop and phone screenshots, relevant environment interactions, errors and packaged assets. PR deploy is intentionally skipped; it is not publication. Any later release also requires guarded squash, successful main Pages deploy and independently authenticated public manifest/bundle identity. Hardware FPS, physical phones and endurance require separate testing.

This document records scope, not a successful full-game validation or a live release. The other foliage/atmosphere experiments remain separate and are not silently included in a maze-only change.
