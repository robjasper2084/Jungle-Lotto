# Swoop Detroit animation and mission pass

Completed locally on 2026-10-03 in the latest working Swoop checkout. The browser game continues to use Three.js, Rapier and the existing Digital Static riding controller.

## Play

Open http://127.0.0.1:4180/Jungle-Lotto/lottominded-ultra.io/games/gothtechnology2/arcade/swoop-detroit/ and choose **Start landmark mission** in Free ride. Stop, ask the Boerboel to Sit, then Come. Ride north through Cut entrance, Woodbridge / Fit Park, Campbell Terrace, Chestnut, Adelaide and Freight Yard. Cross missed markers northbound after turning back. There is no time cutoff. Recovery adds five seconds; the best completed time saves on this browser.

Open **Dog commands · G**, or use Alt + 1–6 for Sit, Down, Stay, Come, Chase and Bark. The original movable dog pads and optional voice controls remain available in Settings. Stay retains the last seated/lying posture; Come releases it. Bark preserves the current order. The dog has a conservative independent speed limit, so a fast rider can outpace it; recall it and slow down to regroup.

## Assets and authoring

- `DS_Boerboel_Polished.blend`: Blender 5.2.1 LTS authoring copy. The original asset-pack master was preserved. The original articulated Idle, Walk, Trot and Run clips remain; Sit and Down use the same skin/skeleton, a grounded pose, soft breathing and smooth runtime blending. The short docked tail does not wag in the game.
- `DS_Boerboel_Polished.fbx`: portable Unity export.
- `DS_Boerboel_Polished-authoring.glb`: uncompressed authoring export.
- `../../public/exports/polish/DS_Boerboel_Polished.glb`: shipping GLB, 3,035,972 bytes versus 8,552,224 bytes before optimization (64.5% smaller), retaining all six clips and one skin. JPEG textures and redundant animation samples were optimized without a new runtime decoder.
- `mission-cover.png`: original Higgsfield artwork; `../../src/detroit/mission-cover.webp`: 1280 × 720 browser version, 113,610 bytes. Higgsfield GPT Image 2.5 job `730c61ee-411c-491a-9ed6-f4d4dd4dd1f0` used 0.25 existing account credits. This generated cover is illustrative; the mapped route remains the source of geographic gameplay.
- `Unity/Assets/Companion/AnimationReview.unity`: review scene, six pose prefabs and a locomotion/Sit/Down Animator controller. Unity 6000.3.24f1 imported the FBX and shipping GLB, verified finite deformed skin, physical scale, ground contact and distinct command poses. The glTFast import contains all six clips. See `Unity/animation-review.json`.

Free tools used: Blender's built-in Action/NLA, IK and exporters; [Unity Animation Rigging 1.4.1](https://docs.unity3d.com/Packages/com.unity.animation.rigging@1.4/changelog/CHANGELOG.html); [Unity glTFast 6.20.0](https://github.com/Unity-Technologies/com.unity.cloud.gltfast); [glTF Transform 4.5.1](https://gltf-transform.dev/) and sharp 0.35.5. Package versions were checked against official registries; stable versions were selected. The review rig layer remains editable; the browser uses the Blender-authored GLB.

## Reproduce

From `swoop-source`, run the installed Blender executable in background mode with the original `Digital_Static_Street_Asset_Pack/source/dog/DS_Boerboel_01.blend` and `--python scripts/build_companion_polish.py`. The script writes new files under this source folder and preserves the master.

Install the isolated optimizer dependencies with `npm install --prefix scripts/asset-tools --cache .asset-cache --no-audit --no-fund`, then run `node scripts/optimize_companion.mjs`. An optional first argument selects another installed tool directory. Optimization always reads the authoring GLB, so repeating it preserves the source export.

Copy the generated FBX and optimized GLB to `Unity/Assets/Companion/`, then run Unity's menu **Swoop → Review companion animations**, or batch `-executeMethod SwoopAnimationReview.Build`. Built-in review checks stop on a missing clip, invalid skin, wrong scale or indistinguishable command pose. Unity uses scale-compensated [BakeMesh](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/SkinnedMeshRenderer.BakeMesh.html) when measuring FBX skin vertices.

Run `npm run check` and `npm test` from `swoop-source`. Build the served package from `gothtechnology2` with `node scripts/build-swoop-detroit.mjs`. The packager retains the preceding package under `.game-builds`. Stop the local preview process before package promotion on Windows to release file handles, then restart `phone/output/swoop-local-preview.cjs`.

## Validation and limits

- 411 existing regression tests passed. After the final animation/camera corrections, 49 focused checks passed, including paused pose stability, ground clearance, limb length, command posture, adaptive graphics and portrait framing.
- A separate real-terrain/controller simulation completed all six mission crossings over 2,020 m with maximum companion separation of 1.49 m. Existing whole-Cut cruising, braking, collision, fall, recovery and camera-clearance checks passed.
- Browser checks verified mission start, Sit → Come progress, command feedback, rendered dog poses, desktop/390 × 844 portrait/844 × 390 landscape layouts and 44-pixel command targets. The portrait chase view now includes the nearby companion.
- Observed local desktop performance on an RTX 3080: roughly 55–60 FPS, with a steady-window median frame time of 16.7 ms and 95th percentile of 16.8 ms. Phone-size emulation validates layout; physical phone, gamepad and VR performance remain untested.
- Adaptive resolution survives resizing and includes severe stalls. Distant crowd animation updates at lower frequency; nearby actors and falling actors retain full updates. Original simulation, controls and collision positions remain intact.
- Local build and TypeScript checks passed. Runtime asset and packaged GLB hashes match. This work has not been published.

Evidence logs and browser screenshots are in the checkout's `output/swoop-polish-20261003/` folder. The implementation began from the existing dirty gameplay work; `before.patch` records that baseline. Unrelated Elmwood and other preexisting changes remain intact.
