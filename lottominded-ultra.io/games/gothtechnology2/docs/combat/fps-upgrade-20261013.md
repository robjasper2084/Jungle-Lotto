# Static Royale FPS upgrade - local delivery, October 13, 2026

## Play locally

Open http://127.0.0.1:8242/arcade/swoop-detroit/royale.html, choose Press start, then Combat block - close-range AI. J gets off/on the wheel; WASD moves, Shift sprints, mouse aims, click fires, right click toggles sights, R reloads. On-foot camera is independently selectable in Settings. Remount restores the riding camera.

## Delivered

- Separate eye-height first-person camera and matching rider hands/weapon view; equip, recoil, landing, sprint lowering, wall obstruction and authority-timed reload phases. Existing stylized assets and procedural animation remain; no new motion-capture clips were purchased.
- Crosshair convergence from the physical muzzle, without aim attraction or bypassing cover. Existing authoritative ammunition/damage and projectile rules remain.
- Shared on-foot collision sliding and clearance checks used by Royale, Swoop Detroit and Elmwood Explorer. Riding and competitive three-respawn rules remain.
- A local training block with two walk-through shops, alley, parked-car/concrete cover and two bots. Render and collision geometry share the same layout. Bots dismount for close fights. This is a small training prototype, not a rebuild of the entire city.
- Material/distance-aware footstep cues and differentiated synthesized weapon reports; bounded remote pose interpolation with life/visibility discontinuity handling.
- All three authoritative room modes deliver validated voice ICE configuration. Optional server-side TURN REST credentials expire after an hour and refresh while listening. No TURN provider is configured yet.
- Local match service and temporary Supabase worker refreshed to physics protocol ridecore-fps-8. Local service health returned 200; worker reported connected. Test lease expires October 14, 2026 at 08:02 UTC. The desktop must stay awake for this temporary relay.

## Verification

- Core and match server TypeScript builds passed. Swoop check and Elmwood's tsconfig.riverwalk check passed. All three local Vite game builds passed, with existing large-chunk warnings.
- 25 automated checks passed: on-foot adapters, aim/strafe, collision, close-range muzzle convergence, reload phases, reduced motion, interpolation discontinuities, bot dismount/fire, three safe respawns, confirmed killer identity and melee cover guards.
- Ten automated local multiplayer clients: seat limit, movement, reconnect identity and AI filling passed.
- Voice signaling in Royale, Swoop and Elmwood: four automated clients across two rooms each; ICE delivery, canonical sender, room/channel isolation, video rejection and leave cleanup passed. This is not a physical microphone/audio quality test.
- Chrome: startup ready, menu, local combat block, dismount into first person, hip fire (20 to 19 rounds), reload (20 rounds / 59 reserve), centered iron sights, upright companion and remount to chase verified. No browser errors in this path. The 390 x 844 reduced-motion layout had no horizontal overflow; touch controls and the first-person view were visible. A duplicate training hint overlapping the phone control hint was removed and confirmed hidden in the final build. Returning from the block to normal practice restored ten riders, the original map and three respawns; no console errors appeared. Viewport and touch-display test overrides were restored.

## Remaining release work

Authored weapon-specific hands/animation and higher-detail environment art remain an asset production pass. Desktop frame-rate, named phone performance, controller feel, latency/loss trials and two-device voice audio have not been certified. Persistent hosting, production TURN and public deployment are not active. See persistent-match-host.md for the concrete server package and deployment gate.
