# Local animation completion review — 2026-10-13

Scope: the animation gaps discussed in the rider studio, including both mascot heroes. Local review only; no production deployment.

## Shared across Swoop Detroit, Static Royale and Elmwood
- Corrected short-leg cadence for both mascots: a 0.72 minimum animation scale replaces proportional scaling near 0.30. Gameplay speed remains equal between heroes. At brisk walking speed the mascot cycle stays below two cycles/second.
- Blender-extracted in-place backward, lateral and diagonal captures from the already installed Kevin Iglesias Human Basic Motions package. Forward walk/run retain the existing TacticalOnFoot captures.
- Direction selection follows actual velocity in the rider's facing frame. Backward movement uses its own capture, not a reversed forward loop.
- Added start/stop weight transfer and turn-in-place footwork, crouch stride fitting, alternating prone hand/leg reach, dodge lean and knock-off recovery posture.
- Connected existing Blender WheelHandling rotations to dismount and reverse remount transitions. Gameplay owns wheel parking and eligibility. Ground correction settles the support foot during the transition.
- Existing fall animation is no longer overwritten by on-foot locomotion.
- Existing finger poses and hero-specific limb lengths are retained.

## Royale
- Directional front/back/side confirmed-hit response and impact-directed falls.
- Healing and accepted-pickup arm gestures, including first-person hands. Healing status is supplied by authority; presentation never changes damage, inventory or eligibility.
- Shooting, reloading, basic melee and combat lean were already present and remain active.

## Sources and editable artifacts
- Seven added directional source scenes: output/animation-completion-20261013/Blender/Tactical_*.blend.
- All five heroes: output/animation-completion-20261013/Blender/*_OnFoot.blend.
- Runtime-baked review GLBs each contain 20 clips (forward locomotion, idle/jump, backward/strafe/diagonal, start/stop/turn, crouch/crawl, mount/dismount, stagger/evade).
- Crouch, crawl, transitions and additive reactions are fitted procedural animation, also baked for Blender review; they are not newly purchased motion-capture clips.
- Original source assets and existing authoring project are preserved.

## Verification
- 22 automated checks passed: actual geometry/skeleton checks on all five heroes, five travel directions across standing/crouch/prone, finite transforms, constant limb lengths, walk loop seams and elbow/hand alignment; cadence, heading selection, history reset, directional impacts; on-foot controller, authoritative melee and killcam regressions.
- Shared core, Swoop and Elmwood TypeScript checks passed.
- Local Swoop/Royale and Elmwood bundles rebuilt.
- Blender imported all five exports and verified walk contact and loop continuity. Both mascots rendered for review. Optional Blender thumbnail-cache writes outside the workspace failed; deliverable scenes and renders saved successfully.
- Browser review covers the local rider studio and local Royale practice. Visual acceptance remains the user's; iPad timing and real-player voice are outside this animation change.

Preview: http://127.0.0.1:4196/arcade/swoop-detroit/rider-studio.html?animationReview=6

## Follow-up and publication
- Mascot walking now has wider shoulder clearance, relaxed elbows and a more visible counter-swing, fitted to each original skeleton. Actual-model tests check jacket clearance and exclude deep running curls during walking.
- Imported the installed Turn01 Left/Right captures through Blender and connected them to stationary turning.
- Authored distinct crouch and prone contact/recovery tracks in Blender. The crawl has alternating hand support and outward/downward knees. These are dedicated authored clips, not motion capture; no captured crouch/crawl asset was found in the installed TacticalOnFoot sources.
- Dodge/stagger include a recovery step and bracing arms in addition to torso movement. Hit direction selects the existing impact-driven elimination motion; the original fall solver remains in use.
- 23 focused checks pass, including all five shipped skeletons, both mascots, contact/loop checks, movement adapters and authoritative combat/replay. Core and both app type checks/builds pass. Twenty editable/baked clips per hero saved locally in the animation-completion output folder.
- Initial release c635752e pushed to main but its Pages deployment failed: 1037.7 MiB exceeded the 1024 MiB artifact limit because superseded JS bundles remained packaged. Follow-up removes obsolete generated JS/CSS only. Publication is confirmed separately after the replacement deployment succeeds.
