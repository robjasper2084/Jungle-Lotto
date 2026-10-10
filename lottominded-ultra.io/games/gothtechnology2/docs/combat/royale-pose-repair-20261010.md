# Royale rider posture repair — 2026-10-10

The Royale combat overlay used inward elbow hints and placed the entire aim turn on one chest joint. With the original suited hero, the regression reproduced an elbow crossing 99 mm into the chest and a 57-degree turn on one spinal joint.

The repair preserves the shared Swoop Hero model and base pose, spreads aim rotation through the existing anatomical spine chain, and derives outward elbow directions from the actual shoulders. It changes no bone lengths, skin weights, weapon balance, projectile rules, or network authority. Royale now starts with the same armored default returned by Swoop's rider selector; all other characters remain selectable.

Validation:

- Existing real-GLB contact regression passes across all five riders, three weapons, aim blend, yaw, pitch, and bank combinations (1,215 scenarios).
- New real-GLB posture regression covers mounted and on-foot poses at nine aim combinations for all five riders (90 scenarios). No elbow crosses the chest center plane; maximum added rotation per spine joint is 19.1 degrees. Existing skin continuity limits pass.
- TypeScript check and production package build pass.
- Local browser practice round starts with the armored hero and responds to riding input with no console errors.
- Close-up comparison uses the actual game Hero and CombatRig classes. Front armored neutral, side upward aim, and rear suited sideways aim were visually inspected against the Swoop base pose.
- No six-human online test or physical mobile-device test is claimed by this repair.
