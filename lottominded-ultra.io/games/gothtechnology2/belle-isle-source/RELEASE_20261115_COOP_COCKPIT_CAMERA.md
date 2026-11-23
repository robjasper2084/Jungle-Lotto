# Belle Isle Explorer — co-op Jetson cockpit camera/visibility repair

Date: 2026-11-15
Status: review candidate only (not deployed).

## Reproduction
The supplied co-op screenshot shows P2 in the Jetson ONE at ~120 km/h, in a split-screen first-person view. The cockpit bars and display are partly visible, but the viewpoint is too far behind/inside the chassis. The game also shows the expected focus-loss pause overlay.

## Confirmed code-level causes
- `coop/session.ts` previously applied a third-person position spring (`lerp(..., 1-exp(-dt*12))`) to **every** co-op camera. At 120 km/h, the ~83 ms time constant means roughly 2.8 m of steady-state lag. The solo cockpit already bypasses this spring.
- `vehicles/models.ts` called rigid batching on Jetson cockpit node descendants after the `JetsonCockpitController` stored references to named dashboard nodes. The generic batching utility did not protect the cockpit hierarchy, so original display/control nodes could be detached if eligible.

## Fix
1. Lock co-op first-person camera position to the active player's physical eye on every tick; preserve follow smoothing only for third-person. A mounted first-person vehicle uses 72° vertical FOV, matching the existing solo view.
2. Preserve named cockpit/dashboard/avionics descendants during static batching; all unrelated static props retain existing batching.
3. Expose per-seat `?profile=1` diagnostics: `data-camera-eye-offset`, `data-cockpit-attached`, `data-cockpit-visible`, `data-cockpit-layer-compatible`.
4. Expand the authored-vehicles browser script to select P2 Jetson first person, assert these diagnostic flags and capture a screenshot; add isolated unit tests.

## Acceptance checklist
- `npm ci && npm run check && npm test && npm run build` from `belle-isle-source/game`.
- Run `node scripts/authored-vehicles-browser.mjs` with the existing built local server setup and Playwright prerequisites; save screenshot `local-four-player-jetson-fpv-cockpit.png`.
- Verify FPV Jetson at standstill, during takeoff, at speed, and after switching back to third-person; P1 view must remain independent.
- Ensure dashboard displays update and control/canopy geometry has no missing elements or camera clipping.
- Repeat with 2-player horizontal and vertical layouts, 4-player splits, compact phone and return to solo.
- Inspect browser console for shader/material errors and missing GLBs; ensure no new render contexts, physics changes or asset downloads.
- Only merge after exact-commit CI, screenshot review, and production-base guard pass. No automatic merge, live push or deployment here.

This release does not alter hover physics, collisions, network transport or saved data.
