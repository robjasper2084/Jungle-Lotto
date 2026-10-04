# Controller and VR

## Standard controller

Connect an Xbox or browser-mapped PlayStation controller with USB or Bluetooth, open the game, and press a controller button. The menu displays a connection message when the browser reports a standard-mapped pad. Click/tap Let's ride once to unlock browser audio; if a controller starts the ride before audio is unlocked, use **Tap for sound**.

| Xbox / PlayStation | Action |
| --- | --- |
| Left stick | Steer; forward/reverse input |
| RT / R2 | Accelerate |
| LT / L2 | Brake in either travel direction; stops at rest |
| A / Cross | Hold to charge, release to hop |
| LB / L1 | Crouch |
| B / Circle | Perform selected trick |
| RB / R1; D-pad left/right | Select a trick |
| X / Square | Recover; retry a completed challenge |
| Y / Triangle | Cycle camera |
| Right stick | Look/orbit |
| Start / Options | Start, pause/resume; free ride after challenge completion |

The adapter handles dead zones, finite/clamped axes, button edges, charge release and disconnect reset. The game pauses on controller disconnect. Custom unmapped controllers require a mapping adapter.

## Quest and HTC Vive

The game uses immersive WebXR. Choose the map/rider on the normal menu, select VR ride speed, then press **Enter VR**. It provides stereoscopic rendering, physical head tracking, tracked controller handles, an in-headset speed/trick/control panel, pause/recovery and the same riding mechanics. The horizon does not roll with the wheel or spin during tricks/falls. Comfort mode limits riding to about 22 km/h and suppresses hop height in the camera; Full riding speed retains normal speed and hop height.

| Input | Quest / controllers with sticks | HTC Vive wands |
| --- | --- | --- |
| Ride / steer | Left stick | Left touchpad |
| Brake | Left trigger | Left trigger |
| Crouch | Either grip | Either grip |
| Charged hop | Hold/release right trigger | Hold/release right trigger |
| Perform trick | Right A | Click bottom half of right pad |
| Next trick | Right B | Click top half of right pad |
| Recover / retry | Left X | Click top half of left pad |
| Pause/resume; free ride after finish | Left Y | Click bottom half of left pad |
| Turn view 30 degrees | Right stick sideways | Right pad sideways |
| Recenter | Right stick click | Exit/re-enter VR to recenter |
| Exit VR | Headset system controls | Headset system controls |

Quest: open **https://digital-static-ride.metavisuallybrucelee.chatgpt.site** in Quest Browser. Persistent trusted HTTPS hosting was successfully deployed on 2026-09-16 with both maps and their runtime models/textures. It is owner-private; sign in with the owning ChatGPT account if prompted. Choose a map, wait for assets, select a rider and press **Enter VR**. The PC can be off for standalone Quest play. The PC's `127.0.0.1` address is local to that PC, not the headset. Meta documents hosted immersive WebXR in [Quest Browser](https://developers.meta.com/horizon/documentation/web/).

PC VR / HTC Vive: use the same hosted HTTPS link with the connected PC's VR runtime and WebXR-capable browser. SteamVR is registered as the active OpenXR runtime on this PC (configuration checked 2026-09-16). Connect the headset, start its runtime, open the hosted game in the PC browser and select **Enter VR** when enabled. Quest can also use its supported PC VR connection. Availability depends on the browser/runtime exposing the headset; the UI reports when no immersive device is available. The local PC preview can still use `http://127.0.0.1:8194/detroit/detroit.html`. No native APK, OpenXR executable or SteamVR build is included.

## Reuse API

`@digital-static/ridecore/input` exports `GamepadRideInput`, `XRControllerInput` and pure VR origin/heading/speed helpers. `@digital-static/ridecore/vr` exports the optional Three.js `VRRide` adapter. Keep these outside a headless/server simulation.

Poll gamepads via `navigator.getGamepads()` and XR devices via the active session's `inputSources`. Feed throttle, steer, crouch, hop and hopHeld to RideCore; route pause, recovery and trick selection edges through host UI state. For XR, use `renderer.setAnimationLoop((time, frame) => ...)`, not a separate requestAnimationFrame loop. Pass the XRFrame to `VRRide.update` so initial room position and recentering align with the wheel. Do not write camera head rotations/FOV while XR is presenting; the headset controls them. Sound must be enabled during the Enter VR user gesture.

WebXR `xr-standard` reserves trigger/squeeze/touchpad/thumbstick indices and preserves missing input slots: [W3C input mapping specification](https://www.w3.org/TR/webxr-gamepads-module-1/#xr-standard-gamepad-mapping). Three.js integrates the session and stereoscopic camera through WebXRManager and its animation loop: [Three.js WebXRManager](https://threejs.org/docs/pages/WebXRManager.html).

## Verification boundary

Automated checks cover standard-pad and Quest/Vive input mappings, charged-hop release, snap hysteresis, disconnect reset, comfort limiting and room-origin math. Desktop browser checks cover non-VR rendering and unavailable-headset behavior. **No physical Quest or Vive session was available for this release.** In-headset visual alignment, device button mapping, comfort, audio output and sustained frame rate still require hardware playtesting. Dynamic shadows are disabled and XR framebuffer scale is reduced during VR to lower rendering cost.
