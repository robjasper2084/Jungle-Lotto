# Digital Static RideCore

**Version 1.1.0 · saved 16 September 2026**

The reusable electric-unicycle riding mechanics from Digital Static Motion 4.1. This package preserves the current controller and body motion while removing Detroit map, UI and asset-loading dependencies. It is a TypeScript/JavaScript library for other games, with an optional Three.js rider adapter.

## Included

- 120 Hz acceleration, braking, reverse, weight transfer, carving, crouch, charged hops and landing compression.
- Seven special moves: curb hop, 180 hop, 360 hop, one-foot glide, rolling pirouette, pendulum and tuck hop.
- Directional falls, collision sweeps, recovery and a following camera with terrain clearance.
- Pedal contact, scrape friction, procedural scrape sound, sparks and overspeed warning beeps. The warning begins above 17 m/s (61.2 km/h); its cadence increases with speed.
- Human and mascot fit profiles. Humans retain the one-foot stop; mascots keep both feet on the pedals when stopped.
- The existing articulated rider solver and smaller wheel proportions.
- Optional two-thumb touch input and Boerboel following/navigation/gait logic.
- Standard gamepad input and WebXR controller input, including Quest sticks/buttons and HTC Vive wand touchpads; optional Three.js VR session/view/HUD adapter.
- Source, compiled modules, declarations, regression tests, an executable headless example and Three.js integration example.

Maps, character meshes, textures, menus, objectives and native Unity/Unreal controllers are not bundled. The companion module supplies movement state; a dog rendering adapter is still required.

## Use in another game

Install the supplied local npm archive in the destination project's folder:

```powershell
npm install "C:/Users/digit/Documents/phone/Digital_Static_RideCore/releases/digital-static-ridecore-1.1.0.tgz"
```

Or unpack the ZIP and import `dist/index.js` directly. For the optional 3D adapter, also install `three@0.185.1`.

```ts
import {RideCore, MASCOT_PROFILE} from '@digital-static/ridecore';

const ride = new RideCore(myTerrainAdapter, {
  profile: MASCOT_PROFILE,
  spawn: {position: {x: 0, y: 0, z: 0}, headingY: 0}
});

// Call once per rendered frame, using elapsed SECONDS.
const {pose, events} = ride.advance(deltaSeconds, {
  throttle: forwardAxis, // -1..1; negative brakes before reversing
  steer: turnAxis,      // -1..1
  crouch: crouchHeld,
  hop: jumpPressed,
  hopHeld: jumpHeld,
  trick: selectedTrickPressed ? 5 : 0
});
myRiderRenderer.apply(pose);
```

`myTerrainAdapter` implements `TerrainSampler`: ground height, upward normal, surface material, obstacle sweep and camera raycast. The runnable [headless example](examples/headless.mjs) supplies a flat world. See [integration details](docs/INTEGRATION.md) for the terrain and rig contracts.

See [controller and VR setup](docs/CONTROLLER_VR.md) for Xbox/PlayStation layouts, Quest/Vive controls and the headset connection requirements.

Audio must be unlocked by a user click/tap:

```ts
import {RideAudio} from '@digital-static/ridecore/audio';
const audio = new RideAudio();
startButton.onclick = async () => { await audio.enable(true); };
// Each frame:
audio.update(pose, isPlaying && !isPaused && !ride.controller.crashed);
// Tear down the game:
await audio.dispose();
```

The Detroit game now unlocks sound when starting/resuming a ride and remembers the Sound on/off choice. A new host should provide its own mute preference and pause behavior.

## Build and verify

Node 22.18 or newer is required to run TypeScript tests directly; compiled JavaScript can run in modern browsers through a bundler.

```sh
npm ci
npm run build
npm test
npm run demo
```

`SOURCE_SNAPSHOT.json` records the source and saved-file hashes. `docs/VALIDATION.md` records the checks performed for this release. The source tests cover physics, tricks, falls, audio routing, touch ownership and companion navigation. The new wrapper is checked against the original controller at 30, 60 and 144 FPS.

## Reuse boundaries

Use this name in future work: **Digital Static RideCore v1.1.0**.

The library runs directly in JavaScript/TypeScript games. [Native engine porting notes](docs/NATIVE_PORTING.md) explain how to reproduce it in Unity or Unreal; this release does not claim a compiled C# or C++ implementation. The Three.js renderer assumes the existing Digital Static bone names and wheel geometry; different characters require rig fitting.

This is a private project snapshot, not a public npm release. Third-party dependency notices are retained under `licenses/`.

