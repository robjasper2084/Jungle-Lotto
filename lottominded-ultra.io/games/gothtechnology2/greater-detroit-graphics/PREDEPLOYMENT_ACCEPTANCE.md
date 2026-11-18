# Greater Detroit Simulation — predeployment acceptance gate

**Current verdict for draft PR #186: BLOCKED.** This is a review-only graphics calibration increment. The three existing worlds have not been joined into one traversal runtime. A production merge is not justified by unit tests alone.

## Release candidate identity and evidence

The exact PR head SHA must be recorded by the CI that produces evidence and must match the SHA evaluated by the acceptance runner. A screenshot captured for an older head is not evidence for a newer one.

### 1. Matched-angle visual comparisons (required)
- Belle Isle: MacArthur Bridge/Detroit skyline (island side).
- Swoop Detroit: same date/hour/weather/exposure reference at the riverfront.
- Elmwood: cemetery gate or adjacent masonry/trees.
- Capture *before/after* from **the same camera position, FOV, view direction, resolution, weather, and solar date/hour within EACH district**. The three districts have different geographic positions; the same global coordinates in all three would show different places.
- Supply baseline and candidate real-game captures, screenshot SHA-256s, shader/graphics settings, capture method, and human comparison notes for luminance, roughness, haze, water reflections, geometric stability and visible lighting seams.
- Claims of physical material scans require actual provenance and rights review.

### 2. Full clean builds (required)
- Belle: \`cd belle-isle-source/game && npm ci && npm run check && npm test && npm run build\`.
- Swoop: \`cd swoop-source && npm ci && npm run check && npm test && npm run build\`. Note: this package refers to an external local RideCore path; resolve its environment in CI rather than falsely claiming a portable clean build.
- Elmwood: \`cd elmwood-source && npm ci && npm run check && npm run test:elmwood\`, followed by the actual Elmwood release packager build in a CI workspace with its RideCore dependency.
- Validate existing GitHub Pages artifact assembly, smoke tests, network failures and size limits. Each build must be associated with the exact candidate SHA.

### 3. Traversal and asset streaming (required)
- **Belle Isle -> Swoop** via MacArthur Bridge; **Swoop -> Elmwood** via a mapped mainland corridor. The bridge is not Elmwood's boundary.
- Execute normal and high-speed crossings in both directions, including camera switches and split controls. Confirm absence of missing collision, terrain holes, stuck riders, abrupt exposure changes, shader recompilation spikes, unexpected resource disposal and aborted GLB requests.
- Run 10-minute traversal/stress sessions and a route graph + local pathfinding pass. A district route graph alone is NOT merged navigation, nor does it make the crossings playable.
- Do not mark this check passed before the single shared runtime and physical terrain seams exist.

### 4. Performance (required)
- Desktop measured **60 FPS** target: p95 <= 16.67 ms; mobile measured **30 FPS** target: p95 <= 33.33 ms, at defined devices/browser/build settings with a minimum 600-second play session. Record average/p95 frame times, shader work, texture/draw-call counts, GPU utilization or GPU frame-timers when available, worst hitch, memory and requests/aborts. Report when GPU timer data is unavailable instead of inventing it.
- Include start/bridge arrival, load bursts, high-speed motion, water and dense foliage; test mobile portrait + landscape, desktop, split-screen and WebXR where supported.
- If over budget, fall back to cheaper reflections/fog/LOD rather than force enabling cinematic effects.

### 5. LUT and peer review
- Final architectural LUT stays **deferred** until exposure/material/shadow geometry is stable, with same-scene before/after captures and color-space validation when finally enabled.
- At least one recorded **independent GitHub APPROVED review on the exact final PR head** is needed. An author approval, outdated-head approval, comments or pending reviews do not satisfy peer review.
- Attach the final evidence artifact as a job upload; do not commit large screenshots/metrics into the source branch.
- Never merge to \`main\` based on this staging check; reconciling \`upgrade-redesign\` with current production and existing Belle Isle exact-head release gates is separately required.

## Status at time of this checklist

- Shared source module: 18 focused local tests and isolated TypeScript check PASS (not a full game build).
- Three-district matching screenshots: NO verified suite.
- Three clean district builds: NOT verified complete.
- Connected traversal: NOT IMPLEMENTED at this stage, therefore BLOCKED.
- Physical desktop/mobile 10-minute frame measurements: NOT VERIFIED.
- Final LUT: DEFERRED, as requested.
- Independent approval: NONE recorded on PR #186.
- Repository branch-protection settings: NOT READABLE with the current GitHub App connection (HTTP 403); do not claim a hard main-branch protection rule exists.
- Source PR: https://github.com/robjasper2084/Jungle-Lotto/pull/186 (draft, targets \`upgrade-redesign\`; production \`main\` unchanged).

**Gate result: BLOCKED until every required item has evidence for the same exact head, a valid reviewer approval and existing release conditions are satisfied.**
