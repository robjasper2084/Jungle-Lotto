# Unity and Unreal port boundary

RideCore 1.0.0 supplies executable TypeScript/JavaScript. It is not a Unity package, MonoBehaviour, Unreal plugin or native rigid-body implementation. Existing character FBX/Blender assets can be reused separately.

For a native port, keep these boundaries:

1. Port `rideDynamics`, `balanceEngine`, `naturalMotion`, `specialMoves`, `fallMotion`, `rideFeedback` and `controller` as a fixed 120 Hz simulation. Preserve seconds/metres/radians and the order of spring, drive, contact and landing updates.
2. Implement `TerrainSampler` using engine collision queries. Maintain multiple surface levels so a bridge deck does not pull riders out of the underpass. Compare collision and visible geometry at every ramp seam.
3. Feed the resulting `RidePose` into a separate animation/IK layer. Use humanoid/generic rig mappings as appropriate; keep both mascot feet on their pedals at rest.
4. Map warning and scrape cues to native audio sources and pedal contact points to particles. Preserve the mute and pause contract.
5. Port the tests as numerical acceptance fixtures. Match straight acceleration/braking, mirrored carving, buffered hops, clean/sideways landing, fall recovery, and each trick before tuning feel.

Unity can retain metres and Y-up; Unreal uses centimetres and Z-up by default, so convert all positions, velocities, normals and rotations consistently. Do not combine the kinematic controller's movement with an independently driving rigid body, which would integrate the same motion twice.

The delivered JS wrapper and optional Three.js view have been tested locally. A native port must be built and playtested inside its destination engine before calling it compatible.
