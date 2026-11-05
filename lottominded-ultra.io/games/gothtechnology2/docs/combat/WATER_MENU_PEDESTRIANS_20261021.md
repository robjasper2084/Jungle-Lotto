# Three-game water, menu and pedestrian release

Source branch: upgrade-redesign. The user authorized publishing all three games.

## Changes

- Shared water contact ripples use an optional WebGPU compute backend, with a bounded CPU fallback and Off setting. A 64 x 64 normal/foam field handles at most eight recent contacts; no extra reflection render pass. This is an original browser implementation, not the Unity water package or a full fluid-height simulation. Reduced motion suppresses contact ripples.
- Game-specific Swoop, Royale and Elmwood menu fronts retain the original setup/settings/online handlers and startup screens. Resume appears during a running session. Keyboard focus, small-screen layout and reduced-motion styles are retained.
- More balanced daylight fill and less harsh direct light, with the existing weather, night settings and light budgets.
- Regular downtown facades regain street-facing ground-floor entrance details. These are visual doors; they do not create new interiors or collision openings.
- Mounted body sweeps cover the torso above the tire; camera clearance protects against raised pavement while permitting ordinary curbs and real bridge underpasses.
- Knocked-off AI riders recover, return to their actual wheel, and finish the existing pickup animation without repeatedly interrupting it to fire. Critical-health restrictions remain.
- Nearby pedestrian animation no longer loses time through a negative pacing-timer reset. Slow traffic uses the same phase speed in stance calculations and animation advancement, keeping supporting feet planted.
- Swoop and Elmwood share the photographer rig. It preserves original bone translations/scales, poses the torso before arm IK, fits the device to the character's reach, and carries it with the hand during raising/lowering. Existing model fingers remain limited by the supplied mesh.
- Includes the pending MSJ-style browser movement, BurntWax-style input priority, and rider/dog presentation updates. Old authoritative snapshots select the previous on-foot prediction law; a matching newer authority enables the new smoothing. No account, microphone, relay or hosting changes were performed.

## Verification

- 22 pedestrian/rig/reuse tests passed, including slow-speed world-space foot planting, elapsed animation time at near/far update rates, camera grip transitions and headings, all five hero rigs, and Elmwood's shared view.
- 64 focused regression tests passed: respawn/reentry, raised surfaces, AI recovery, mouse press/release ordering and cancellation, combat controls, shadow scheduling, dog presentation, building entrances and bounded water fields.
- Seven movement tests passed, including exact prediction of legacy authority acceleration and switching to upgraded snapshots.
- Both source-local TypeScript checks passed. Swoop/Royale and Elmwood rebuilt through the existing prepare/buildCode workflow; all package validations passed. Local served HTML/entry scripts matched the generated files byte-for-byte.
- Embedded-browser photographer front/side inspection; Elmwood startup and new menu verified. Earlier checks in this pass verified Swoop and Royale menus, settings and resume, and actual WebGPU ripple dispatch on Elmwood water with no shader error.

Local evidence: output/building-entrances-20261021 (relative to the phone workspace), including screenshots, tests, type/build output and HTTP hashes. The isolated release index starts from origin/main and preserves the working checkout.

## Limits

No physical iPad or sustained all-opponent 60 FPS claim. The large existing game chunks still produce build-size warnings. No fresh real-player voice test or server deployment. The newly observed Chene spawn beneath the amphitheater canopy still needs a route-specific review. This release does not claim that every historical request is complete.
