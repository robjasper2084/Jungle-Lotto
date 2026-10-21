# MSJ-derived on-foot movement — local integration

The current Swoop Detroit, Static Royale and Elmwood games are TypeScript/Three.js games, not Unity WebGL builds. This integrates the downloaded MSJ controller's movement-smoothing design into the shared browser motor. It does not run Unity C# or replace the games with MSJ's demo.

## Inspected source

- Asset: MSJ – Top Down Character Controller, Unity Asset Store product 389880, publisher ShahvaizJ.
- Downloaded using Unity Package Manager → My Assets → MSJ → Download on 2026-10-21.
- Original archive retained outside the public repository: `C:/Users/digit/Documents/phone/output/msj-controller-package/MSJ-Top-Down-Character-Controller.unitypackage`.
- Archive SHA-256: `6649a7c0cfa26c71933159c2e6f38ef4c8c55c5d8f3e246b088aef9ee8a7a6bd`.
- Inspected `Assets/MSJ-TDCC/Scripts/ThirdPersonController.cs` (SHA-256 `e3c1599124a45aa789304a01490eab5a6a29745461e74df2110a573864cfdf1b`), `CameraHandler.cs`, `PlayerHandler.cs`, `CharacterControllerImpact.cs` and Readme.
- Store metadata advertised 1.0.1 before downloading; Unity displayed “Import 1.0 to project” afterward. The archive and source hashes identify exactly what was inspected without assuming the metadata discrepancy is resolved.

## Integration and deliberate adaptations

`ride-core/src/msjLocomotion.ts` implements MSJ's two smoothing stages (0.1-second movement intent, 0.2-second velocity transition), integrated at the existing authoritative simulation ticks. Exact exponential integration replaces frame-dependent Lerp coefficients. The stages blend planar velocity components so direction changes and reversals do not instantly flip the moving character.

MSJ gates final displacement using raw input; the browser adaptation uses a short 0.04/0.08-second braking blend when releasing an axis. It stops without a long coast while avoiding a hard velocity discontinuity. Analog joystick input remains proportional rather than snapping to the demo's half/full input bands. Existing walk/run/reverse, crouch/prone and stagger speed caps are preserved.

`ride-core/src/onFoot.ts` calls this motor only when fully dismounted. All three games already route their on-foot simulation through this function. It retains their existing input conventions: aim-facing strafing in Royale, steering in Swoop/Elmwood, and reverse playback of the supplied forward walk. This does not change the user's cameras into the demo's fixed top-down view, nor import its managers, input assets, stamina rules or inventory.

Collision sweeps, curb steps, ceiling checks, jump gravity, actual-distance animation phase, wheel parking, pickup/remount timing, knock-off momentum, health/inventory and respawn authority remain in their existing owners. Mounted wheel handling and the recent shadow/dog presentation fixes are untouched. No additional asset loading, frame callback or network message is introduced.

The four numeric smoothing values are included in existing controller capture/restore snapshots. They reset on spawn, dismount/mount transitions and full blockage. Wall sliding clears blocked-axis acceleration. Older snapshots missing these optional historical values initialize safely on their next movement step.

## Release boundary

Local review only. A future multiplayer release must rebuild the clients and authoritative server from the same shared RideCore source; do not mix a new predicting client with an old movement server. The original Unity archive, extracted scripts, demo and dependencies remain outside public game assets and source releases.

## Verification

Evidence, command logs and browser screenshots: `C:/Users/digit/Documents/phone/output/msj-on-foot-20261021/`.

Automated coverage includes smooth starts, proportional analog and diagonal speed, frame-rate convergence, reversal, stopping, low stance limits, deterministic replay/restore, reset, knock-off momentum, jumping, blocked terrain, curb/raised-surface walking, aim turns and remounting. Physical iPad feel and real-player network retesting remain separate from local desktop validation.
