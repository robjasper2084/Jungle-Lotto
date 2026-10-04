# Integration contract

## Coordinate system and timing

Use metres, seconds and radians. Y is up. Heading zero travels toward +Z; positive heading turns toward +X. `RidePose.y` is the wheel/ground contact plane, not the hip or wheel axle height. Do not add a second ground offset to the rendered root.

Call `RideCore.advance(deltaSeconds, heldInputs)` once per render frame. It steps at 1/120 second, interpolates the render pose, and buffers hop/reset/trick edges across frames shorter than one step. A held trick cannot continuously repeat. Time beyond 0.25 seconds per frame is dropped to avoid a catch-up spiral. `droppedSeconds` reports that amount; reset the host clock after a pause.

`current` is the latest fixed-step pose; `previous` is the previous pose; the returned `pose` is a reused, interpolated object. Copy it before retaining a history. `snapshot()` returns readable gameplay diagnostics. Events are collected from every substep of the current frame: `trick` (message/points), `landing` (impact/quality), and `crash` (reason). Awards may have a zero-point status event before completion; only add `points` to the score.

Call `reset({position,headingY})` for a new spawn. Send `reset:true` as an input edge for gameplay recovery, which retains session counts/distance. `setProfile` updates simulation fit; replace the ThreeRiderView too when changing character assets.

## TerrainSampler

| Method | Contract |
| --- | --- |
| `sampleGround(x,z,out,referenceY?)` | Mutate and return `out` with surface height, upward unit normal, material and offCourse. Use referenceY to distinguish a bridge deck from the trail underneath. |
| `raycast(origin,direction,maxDistance)` | Nearest blocking surface distance, or null. Camera uses this for occlusion and overhead clearance. |
| `raycastObstacle(origin,direction,maxDistance,sweepHalfWidth?,sweepLateral?,out?)` | Swept obstacle distance, or null. Normalize direction before using an engine ray API; callers may pass displacement vectors. Respect sweep width to avoid clipping walls and people. |
| `navigationObstacles(x,z,radius)` | Optional nearby obstacle list for the companion, including position, radius, height, kind and velocity. |

Supported materials: pavement, grass, brick, dirt, gravel, sand, metal, wood and ice. Return a valid sample everywhere a rider can travel. Visible ramps and bridge decks must match collision heights, including their approach transitions. The controller cannot repair holes or incorrect heights in the host map.

## Rendering and rider fit

Import `ThreeRiderView` and `PedalSparks` from `@digital-static/ridecore/three`. Load your rider and separate EUC GLBs using GLTFLoader, then pass those assets, the terrain and the selected profile to the view. It clones the skeleton and wheel scene; shared geometry/materials remain owned by the host. Call `view.dispose()` on replacement.

TypeScript hosts using the optional Three.js/VR modules should install `@types/three@0.185.0` along with `three@0.185.1`. The headless core has no Three.js runtime dependency.

Required leg bone chains are `LeftUpLeg -> LeftLeg -> LeftFoot` and their Right counterparts. Arm chains are `LeftArm -> LeftForeArm -> LeftHand` and Right counterparts. The solver also uses `Hips`, `Head`, `Neck`/`neck`, `LeftShoulder`, `RightShoulder`, and the original chest-down spine naming (`Spine02`, `Spine01`, `Spine`). `Chest` is a fallback. Rename/retarget other rigs to this anatomical hierarchy, or adapt the binding code.

The first animation clip at time zero supplies the standing rest pose. Rider feet should begin on y=0 in their asset. The separate wheel uses `Wheel_Pivot` and `Body_Suspension`. Pedal height and width are matched to DS_EUC_01: 0.296 m and +/-0.195 m before scaling. Scrape corners in `rideFeedback.ts` likewise match that wheel; alter them when replacing the EUC geometry.

Default profiles:

| Profile | Wheel scale | Motion scale | One-foot stop |
| --- | ---: | ---: | --- |
| HUMAN_PROFILE | 0.86 | 1 | Yes |
| MASCOT_PROFILE | 0.75 | 0.48 | No |

Foot-down suppression applies to stopping. The deliberate one-foot-glide trick remains available to mascots. Preserve bone segment lengths; adjust fit/IK targets instead of stretching a short character into a human pose. Verify front, side, crouch, bank, takeoff, landing, fall and recovery views for each new rig.

`examples/three-integration.ts` wires the view, following camera, audio and sparks. The host supplies the render loop, asset loading, scene lighting, input mapping and UI. First-person and orbit UI from the Detroit game are host features; only the reusable following-camera implementation is packaged.

## Input, sound and companion

`TouchRideInput` owns pointer IDs so a second finger cannot steal the stick. For a custom UI, use its methods directly. The supplied `bindTouchControls` helper expects DOM IDs `stick`, `stickThumb`, `brake`, `crouch` and `hop`. It returns an input-reset function, not a component unmount function. Remove the DOM/handlers when unmounting the host UI. Release all inputs on focus loss and pause.

Pass the same pose to `RideAudio.update()` and `PedalSparks.update()`. Ground contact produces scraping; speed warning pulses come from the controller. Do not manufacture a beep from speed separately or it will compete with the built-in cadence. Mute on menu, pause, completion and crash. `audio.state` exposes the context and bus gains for diagnostics, and `dispose()` closes its AudioContext.

`DogFollower` is exported from `@digital-static/ridecore/companion`. Its 7.5 m/s cap is gameplay tuning; it does not speed-match a faster rider or teleport to close a gap. Use a separate visual dog rig/adapter and the optional obstacle query for avoidance and jumps. This package does not include the Detroit dog mesh renderer.
