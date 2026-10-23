# Aim and weapon-transition polish — local follow-up

Prepared separately from release PR #110 (`6330c18f`). These follow-up changes are local and have not been published.

- Corrected camera-mode matching for `foot-ads`, `ride-first` and spectator-prefixed modes. The shared camera adapter now honors its existing immediate-aiming rule in Royale. Ordinary third-person/orbit changes still blend; reduced motion and teleport resets remain immediate.
- Rapid weapon selections now continue from the current lowered-hand pose instead of restarting at the fully raised position. Returning to the original weapon reverses smoothly, and replacements appear only after the old weapon is lowered. Firing and reduced motion still select the authoritative weapon immediately.
- First-person lifecycle resets also reset the cosmetic weapon-swap state, preventing a stale draw animation after a life/timeline reset.

No simulation, hitbox, projectile, damage, ammunition or authoritative timing changes.

## Verification

The old camera adapter left a requested 1.7m ADS eye at 0.017m and a requested 40-degree FOV at 67.71 degrees on the first transition frame. The corrected adapter reaches the requested position and FOV immediately. Retargeting a weapon swap with zero elapsed time previously changed the lowering amount from 0.741 to 0; it now stays at 0.741.

29 targeted tests passed: camera transitions, 30/60/120Hz weapon-swap timing, rapid interruption/reversal/reset, mouse button press/release order, movement-only fire prevention, sprint/aim/reload priority, per-scope sensitivity, crosshair convergence at 10–100m and camera clearance. Both source TypeScript checks passed. All three entries rebuilt and package validation passed; the existing large Elmwood bundle warning remains.

Embedded-browser shooting-range check: dismount, ADS, shot (20→19), reload (20/59), first-person view and holster/draw completed. First-person camera was 76 degrees, ADS 43 degrees; both grip-solver residuals were below 0.000001 in the sampled settled pose. This is a functional desktop check, not physical iPad validation or a claim that all animation artistry is finished.

Evidence: `C:/Users/digit/Documents/phone/output/three-game-startup-release-20261022/local-fpp-polish.png` and `polish-build.txt`.

Local review: http://127.0.0.1:8261/arcade/swoop-detroit/royale.html?aimPolish=20261022&profile

Changed source: `ride-core/src/cameraPresentation.ts`, new `ride-core/tests/camera-combat-transitions.test.ts`, `swoop-source/src/detroit/royale/fpsMotion.ts`, `fpsActions.test.ts`, `firstPersonView.ts`.
