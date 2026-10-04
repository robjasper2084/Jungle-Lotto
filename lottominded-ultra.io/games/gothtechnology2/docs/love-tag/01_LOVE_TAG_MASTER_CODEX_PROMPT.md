# LOVE TAG: HEART RUSH
## Master Codex build prompt — Swoop Detroit + Elmwood Explorer

Prepared October 3, 2026. This file is an implementation specification, not a completed game, deployed server, generated asset pack, or playtest report.

## 0. Mission and execution contract

Act as the lead gameplay engineer, multiplayer networking engineer, technical artist, and browser-game QA engineer. IMPLEMENT an original, movement-first EUC Tag mode called **LOVE TAG: Heart Rush** in BOTH Swoop Detroit and the separately packaged Elmwood Explorer.

The core fantasy is fast, playful pursuit: accelerate, carve, brake, hop, use cover, anticipate another rider's route, then tag by proximity contact or by firing a heart-shaped projectile from a stylized Love Gun. Borrow the movement mastery and chase intensity of Gorilla Tag as a design reference, not its assets, branding, maps, code, or arm-driven locomotion.

**REAL ONLINE MULTIPLAYER IS REQUIRED, NOT OPTIONAL.** Offline bots, split-screen, a fake room menu, two unsynchronized canvases, and scripted opponents do not satisfy online multiplayer. Deliver a real authoritative server, connected browser clients, room creation and joining, invitation flow, server-confirmed tags, synchronized round state, reconnection, and independently controllable human riders. Support humans-only, humans plus server-controlled bots, and standalone offline AI matches.

Execution settings:
- `EXECUTION_SCOPE=CORE_RELEASE` by default: implement Phases 1–4 below, including working online server/client code and deployment preparation. Do not silently stop at offline-only Phase 1 and call the request complete.
- An explicitly supplied `PHASE=1`, `PHASE=2`, etc. narrows that execution to that phase. Record unfinished online requirements as pending, never optional.
- Work in checkpointed increments. Implement, test, and repair each increment before adding scope. At an execution limit, leave a precise status file and next runnable step; do not claim background work will continue.
- Do not automatically merge, deploy, provision paid infrastructure, buy assets, start paid Higgsfield generation, or change billing. Prepare code/configuration and identify the exact credential or authorization needed for hosted verification.
- Do not guess remaining credits or promise a fixed credit cost. Limit repository reading to relevant source/dependencies; avoid repeated whole-project scans and broad refactors.
- If the selected phase's source and tools are available, deliver code and tests, not only recommendations. Real blockers must be reported precisely, with everything independently achievable still completed.

Full completion requires evidence for both actual games. Track these separately: `implemented`, `unit_tested`, `browser_tested`, `network_local_tested`, `internet_staging_tested`, and `deployed`. A checked source file or localhost test is not evidence of public internet availability.

## 1. Locate the correct projects and preserve current work

Repository: `robjasper2084/Jungle-Lotto`.
Repository base: `lottominded-ultra.io/games/gothtechnology2/`.

### Target A: Swoop Detroit
- Source: `swoop-source/`, especially `src/detroit/`.
- Build: `scripts/build-swoop-detroit.mjs`.
- Packaged output: `store/public/arcade/swoop-detroit/`.
- Packaged entry: `index.html`.
- Asset-pack override: inspect the current `SWOOP_ASSET_PACK` contract.
- Public reference:
  `https://robjasper2084.github.io/Jungle-Lotto/lottominded-ultra.io/games/gothtechnology2/arcade/swoop-detroit/`

### Target B: actual Elmwood Explorer
- Build: `scripts/build-elmwood-explorer.mjs`.
- Its source is a separate project, resolved by the current `ELMWOOD_SOURCE` configuration or the existing `euc-detroit-riverwalk` location. Inspect the current script rather than assuming an old working-directory-relative path.
- Entry: `elmwood.html`; source integration candidates include `src/elmwood.ts` and `src/elmwood-ride.ts`.
- Packaged output: `store/public/arcade/elmwood-explorer/`.
- Store wrapper: `scripts/elmwood-explorer-embed.js` and `.css`; inspect shared mobile-HUD integration too.
- Verify the actual arcade launcher and iframe URL. Do not assume Explorer's entry is `index.html`.

Swoop's internal `?map=elmwood` support is NOT the separately packaged Explorer. Editing that map alone is not dual-game integration.

Read applicable `AGENTS.md`, manifests, lockfiles, build scripts, and existing tests. Inspect the actual `@digital-static/ridecore` dependency and local `Digital_Static_RideCore` workspace. Reuse shared rules and movement capabilities where present. Current inspected Swoop metadata lists Three.js, Rapier, TypeScript/Vite, and a local RideCore dependency; recheck versions before editing. Preserve lockfiles and avoid wholesale dependency upgrades.

The recently inspected packaging scripts use preparation/preflight helpers, including `game-package.mjs`, `buildRelease`, `readableTree`, `runtimeLicenses`, and `modelDependencies`. Preserve and extend this safer pipeline; do not replace it with destructive direct-output builds. Read any exported prepare/build entry points before invoking them.

Record actual source roots and revisions. Use a feature branch such as `feature/love-tag-online`; preserve unrelated uncommitted work. Work only in authorized source roots. If the external Explorer source is absent, do not manufacture a new Explorer or patch minified bundles. Mark that integration blocked, report the missing path/dependency, and continue genuinely independent shared work.

This is an ADDITIVE Tag feature. Preserve normal riding, existing EUCs, riders, Boerboel companions, bicycles where implemented, community rides where implemented, maps, landmarks, free exploration, racing, practice, local challenges, ghosts, replays, audio preferences, accessibility settings, split-screen, XR, and store/reward integration. Do not assume every earlier requested feature already exists; inventory it honestly. Earlier bicycle/community-ride work remains separate and must not be deleted or rebuilt unnecessarily.

Inspect the current controller, movement tuning, input mapping, terrain/collision queries, camera, renderer lifecycle, lobby, pause bridge, and save flow. Names to investigate include `controller.ts`, `rideDynamics.ts`, `rideRules.ts`, `main.ts`, `touchInput.ts`, `gamepadInput.ts`, `followCamera.ts`, `actors.ts`, and their Explorer/RideCore counterparts. These are inspection targets, not permission to rewrite all of them.

## 2. Required player-facing feature set

Each game's real menu must expose:
1. **Play Offline**: choose Classic or Spread the Love and AI difficulty; play immediately without an account or server.
2. **Create Online Room**: select map-compatible arena, ruleset, participant target, bot fill, and privacy; receive a room code and invitation link.
3. **Join Online Room**: enter a code or follow an invitation; load the correct game/map and synchronize with the server.
4. **Controls / Settings**: remapping, aim sensitivity, assistance, accessibility, audio, and existing layout customization.

The online lobby needs actual participant names, human/bot labels, ready status, capacity, map, ruleset, connection status, and host controls. Host controls configure a lobby; the host's browser is NOT the authority for simulation or scoring. Bots cannot be labeled as remote humans.

Initial active capacity is 8 riders total, including bots. Classic supports 2–8 participants. Spread the Love targets 4–8; clearly offer bot fill or Classic when fewer than four are available. A one-human online room may start with bots but must say so. Offline default is one human plus three bots. Use a separate small spectator cap, initially four; account for spectator connections separately from active seats.

A room contains ONE map/arena and ONE compatible physics configuration. Users arriving through either product may follow an allowlisted navigation to the selected game before joining. Do not attempt to put riders on two different maps into one physical match. Keep existing free-roam/exploration sessions separate from a dedicated Tag arena session.

Private invite rooms are mandatory. Public room browsing/quick match is a later gated feature, not a prerequisite for testing real online play. The absence of public matchmaking must not block private online matches. Conversely, a private-room UI with no working server is not multiplayer.

## 3. Shared match rules and state machine

Lifecycle:
`lobby -> loading -> countdown -> head_start -> active -> results -> rematch/loading -> ... -> disposing`.
Include cancellation, failed load, insufficient participants, and server shutdown. Transport disconnect/reconnect is separate from the gameplay state machine.

Initial round duration is 180 seconds of active simulation, excluding loading/countdown/head-start. Give runners a 3-second opening head start with tags disabled and the initial tagger held in place. Use authoritative ticks for timers, not client wall clocks. Freeze the roster at round start; late human arrivals spectate until the next round.

### Classic Love Tag
- Exactly one active participant is It throughout active play, including a temporarily weapon-locked It.
- A valid heart hit OR contact tag transfers It to the target; the previous It becomes a runner.
- The new It may move but cannot tag or shoot for 2 seconds. The former It receives the corresponding brief protection from immediate tag-back. Display both states.
- Accumulate authoritative time as It. Rank round-eligible finishers by `effectiveItSeconds = accumulatedItSeconds + 3 * voluntaryResetCount`; lower is better, with tied winners for equal totals. Display time and reset penalties separately. Secondary statistics: successful tags and longest escape.
- Rotate initial It across rounds. Do not let the host repeatedly assign a disadvantage to the same player.
- A participant who permanently leaves or forfeits cannot win by avoiding further It time. Reconnecting reclaims the same seat and history.
- Every role change advances a role epoch. Invalidate the former tagger's outstanding tagging projectiles. Old projectiles, inputs, or hit callbacks cannot create a second inconsistent transfer.

### Spread the Love
- One initial tagger; every validly caught runner becomes a tagger.
- Taggers win when no eligible runners remain. Surviving runners win at the time limit.
- Converted riders continue playing; no long death or respawn screen.
- New taggers may move during a 2-second activation delay but cannot tag/shoot until it ends.
- Only taggers fire effective tagging hearts. Runners evade using movement. Preserve the same physical handling and ability budgets for both roles.
- Simultaneous catches of one runner produce exactly one transition and one credited tag. No multihit conversion chains through a single projectile.
- At the final active tick, resolve valid in-tick impacts before the expiry check, consistently in both local and server simulations.

No headshots, health damage, paid advantages, real prizes, or automatic transfer of Tag scores into LottoMind credits or store discounts. Keep future cosmetic progression separate from trusted monetary systems. Do not add a team-shooter ruleset during the first release.

## 4. Love Gun, tagging, and deterministic event resolution

Visual direction: an original rounded, playful energy launcher with a heart-shaped opening, charge indicator, restrained glow, and readable recoil animation. It fires unmistakable heart-shaped visuals. No gore, physical knockback, or forced crash from a successful tag.

All values below are initial playtest targets, not claims about present code or measured balance:

| Parameter | Initial target |
|---|---:|
| Heart speed in world space | 24 m/s |
| Maximum distance | 24 m |
| Maximum lifetime | 1 s |
| Projectile collision radius | 0.14 m |
| Minimum interval between shots | 0.7 s |
| Heart-charge capacity | 3 |
| Regeneration | 1 charge per 2 active seconds while below capacity |
| Role transition lock | 2 s |

Use one canonical typed configuration consumed by rules, server, offline simulation, UI, and tests. Do not scatter magic numbers. Regeneration accumulates fractional time deterministically and pauses outside active gameplay. Begin the round with three charges. Role swaps, recoveries, menu toggles, and reconnects do not instantly refill ammunition. Runners can regenerate but cannot fire effective tagging shots.

A shot's world speed is the configured 24 m/s; do not accidentally add EUC speed unless introducing a separately tested, versioned rule. Range and lifetime are both enforced. No homing, random spread, piercing, or ricochets initially. The server calculates the muzzle position from authoritative rider state and validated aim; the client cannot supply an arbitrary origin or target hit.

Use simple projectile collision geometry independent of the decorative heart mesh. Integrate using fixed steps; sweep from previous to next position. Test against moving rider tag volumes, not only frozen endpoints; use relative motion or equivalent continuous narrowphase for fast crossings. Compare time of impact against solid world obstruction, including obstacles blocking the muzzle. Stop at the first blocking surface; prefer a blocking wall on an exact collision tie rather than allowing a through-wall hit.

Standardize participant tag volumes independently of mesh size, outfit, accessory, and rider skin. Fit and visualize one sensible seated/riding volume in a debug view, including ground-relative height and vertical overlap. Do not let oversized costumes alter competitive reach. Disable costume-dependent physical advantages within Tag as well.

Contact tags require overlap of the defined tag-contact volumes and unobstructed local space. Do not use a 2D radius that tags through walls, floors, bridges, or height separation. Ordinary player-to-player contacts use bounded deflection/soft separation, not griefing through large ramming impulses. Retain solid environment collision.

Ignore the shooter, spectators, nonparticipants, and inactive tagging layers as specified. Friendly taggers in Spread do not receive tags; use one documented projectile-filter policy consistently. Nonparticipant companions and community crowds are removed from the competitive collision layer and kept out of the active arena.

Every shot and resolved event needs stable IDs: match/round ID, shooter ID, input/shot sequence, spawn tick, role epoch, and projectile ID. Resolve candidate impacts in deterministic order, using time-of-impact and stable IDs; the first valid event owns the target transition. Queue rule changes at an explicit simulation stage and reject duplicate or stale callbacks.

Third-person aiming selects an intended point from the camera, but the projectile travels from the actual muzzle. Never allow camera-peeking to shoot through cover. Clamp aim yaw/pitch to tested anatomical and gameplay bounds; show when aim is blocked. Critical hit cues appear only after authoritative confirmation. Locally predicted muzzle flashes or hearts must reconcile or fade on rejection without false tag credit.

## 5. Tag-only EUC handling and ability profile

Extend the existing controller/RideCore rather than writing a disconnected replacement. Introduce injected `TagHandlingProfile` data. Every helper that previously read global values must receive the right profile where needed. The profile is scoped to a Tag session and restored on exit, error, restart, and map change.

Starting targets for Swoop: normal top speed 10 m/s, burst cap 13 m/s. Explorer may initially use 8 m/s and 10.5 m/s respectively after validating available lane width and turning clearance. Different map profiles apply equally to every participant and are part of compatibility/versioning. These are fictional game settings, not real-world riding guidance.

Keep smooth motor onset, meaningful braking, speed-sensitive steering, and bounded lateral acceleration. A tight corner at speed must require braking or a wider radius. No instant full-speed 180s, teleport dodges, uncontrolled drift boost, or permanent stabilization that erases the EUC identity.

Retain the familiar hold/release hop. Target about 0.5–0.75 m clearance on level ground by adjusting the tested takeoff impulse, not global gravity. Preserve short buffered input and ledge grace where supported. Allow limited in-air correction and momentum retention; no flight, double jump, wall climbing, or infinite air steering.

Add **Flow Burst** as a separate remappable action:
- 0.6-second acceleration burst along the current travel direction, not a teleport or lateral dash.
- Flow capacity 100; activation costs 35; initial cooldown 3 seconds.
- Regenerate at 10 units/second after 1.25 seconds of controlled grounded riding without another burst or heavy impact.
- Terrain, speed caps, cooldown, and collision remain authoritative. Trigger only in valid grounded/control states. No repeated charge from pause/reconnect or event replay.

Minor scrapes cost speed with readable feedback; substantial impacts still require short recovery. Good landing alignment preserves speed; rough landings cost speed and delay immediate burst use. Keep recovery predictable and avoid long ragdoll sequences in a three-minute chase.

On ordinary crash recovery, retain role and ammunition; return close to the incident at a tested valid anchor. Recovery does not grant invulnerability or teleport across the arena. For an explicit manual reset or boundary timeout, use a documented anti-exploit rule: Spread runners convert without awarding anyone a tag; Classic runners become the sole It through the normal transfer machinery with an explicit reset penalty in the score. Current taggers stay taggers. Display the consequence before an intentional reset. Automatic corrections caused by a verified engine placement failure are separately logged, rate-limited, and must not repeatedly grant protection.

Evaluate bodies and wheel contacts on each map's terrain. Do not force a second physics engine into either client. Where a separate server process uses the same physics implementation, share the same movement logic, collision fixtures, units, and versions rather than approximating the client with unrelated equations.

## 6. Arenas and session isolation

Create one real, bounded arena on each existing map. Derive geometry, paths, safe spawn anchors, restrictions, and cover from actual source data. Do not fabricate landmark coordinates, transform conventions, or connectivity.

Swoop arena: connected urban pursuit routes, turns, cover, passing space, and a few hop opportunities. A roughly 300–500 m connected route network is a starting design target, not a requirement to invent streets. Avoid an unbroken linear drag strip; verify at least two meaningful alternatives around important cover. Add minimal reversible event props only on verified valid surfaces when needed.

Explorer arena: existing connected lanes and permitted open riding areas with bends and vegetation. Preserve pond, landmarks, trees, landscaping, memorials, burial areas, and information content. No grave/monument platforms, shortcuts through water or planted areas, fabricated history, or destructive effects. Hops only where the selected lane geometry supports them. Keep cues readable but quieter than the urban arena.

Arena data includes map ID, arena ID/revision, legal surfaces, bounds, height limits, route graph, spawn candidates, recover anchors, obstacle masks, collision hash, and rules/handling version. Server and clients use the same canonical collision source and coordinate transform. Test map-local/world conversion, mirrored axes, origins, units, slopes, and stacked surfaces.

Select spawns with valid ground, clearance, and separation; score candidate distance and line of sight to opponents. Never choose an arbitrary random coordinate or spawn inside a wall. Use a 3-second visible boundary warning before the documented reset consequence. Avoid invisible walls or unexplained forced teleports.

Entering Tag snapshots/restores user settings and suspends incompatible local world systems: active races, score/reward trackers, ghost playback, community crowds, AI traffic inside the arena, and dog collision. Spectator companions may remain visually outside the arena without simulation advantage. Leaving Tag restores original systems exactly once. Scene switching must dispose room bindings, input handlers, timers, temporary geometry, and rendering effects.

## 7. AI: genuine pursuit and evasion

Share AI rules across both games; use per-map navigation adapters. A group-ride spline or replay recording is not Tag AI.

Bots produce the same validated input commands as humans. They have the same controller, speed, aim envelope, charge regeneration, burst meter, recovery, and tag rules. Do not directly teleport bots toward goals or award hits bypassing projectile collision.

Behavior states: observe, choose target/escape goal, pursue, intercept, evade, aim, dodge, recover, and regroup in pre-round only. Taggers can intercept a plausible exit; runners use cover, alternates, braking feints, and limited hop routes. Explicitly test every navigation edge a bot can use: width, slope, clearance, braking distance, and required hop ability.

The perception interface exposes only permitted sightings and recent simulated sound/memory. Do not give a bot's decision layer exact hidden-player positions merely because the server knows them. Test loss of sight, bounded last-known position, search, and reacquisition. Hearing is synthetic in-game sound, not microphone recording.

Initial reaction delays: easy 0.6 s, normal 0.35 s, hard 0.2 s. Difficulty changes reaction delay, aim error, prediction quality, and route choices; never hidden speed or infinite ammunition. Use seeded, reproducible randomness, stable actor IDs, and bounded memory. A bot must obey the same no-tag transition window.

Run strategic decisions around 5 Hz, steering around 20 Hz, and actual movement on the normal fixed simulation steps. Use existing broadphase/spatial partitioning for nearby queries. Online bots execute ONLY on the authoritative server; offline bots run through the same rules in-process. Fill/rebalance slots between rounds so late humans do not suddenly replace moving bots mid-chase. Label every AI seat visibly.

## 8. Controls, camera, accessibility, and UI

Map abstract actions first: throttle, steer, brake, hop hold/release, aim yaw/pitch, fire, burst, look-back, recover, recenter, menu, ready, leave. Preserve established riding controls where feasible. Use a Tag-specific binding layer that is removed on exit; do not permanently repurpose another mode's controls.

Desktop: simultaneous riding and independent bounded aiming; remappable fire/burst; safe pointer-lock entry/release; no shots when clicking UI. Gamepad: preserve acceleration/braking access, assign tested fire/burst/hop controls, handle deadzones and disconnect. Touch: separate steer and aim areas, large Fire/Burst targets, correct pointer capture, safe-area spacing, and no simultaneous-pointer theft by overlays.

Preserve Explorer's movable/resizable/reassignable touch buttons, fixed/floating stick choice, and independent portrait/landscape settings. Save Tag overrides separately and respect reset/customize workflows. Handle storage-denied and malformed saves.

Offer adjustable aim sensitivity, inverted Y, hold/toggle aim, and modest aim slowdown for touch/gamepad. Aim assistance requires visible targets and valid range, never hidden-target lock-on or homing. Display the active input/assist preset and do not hide an advantage. Keep rules server validated; do not equate server authority with perfect anti-cheat.

Use the existing follow camera with stable horizon and meaningful forward visibility. Support recenter/look-back, camera clearance, and firing from the muzzle. No heavy forced shake, continuous zoom pumping, or motion blur required for play. Respect reduced motion and color-vision differences; roles use text/icons/patterns, not color alone.

HUD: role, round time, charges, Flow, remaining runners or It indicator, confirmed tag feed, and compact network state. Secondary settings stay collapsed. Sound cues for shot, empty charge, role change, tag confirmation, and round end need visual equivalents. Respect saved mute and user-gesture audio unlocking.

Offline pause freezes the entire match. Online menu/focus loss clears local held input and releases pointer lock but DOES NOT pause the authoritative room or protect the player. Show 'Match continues online'. Bind the existing Explorer ready/pause bridge correctly: do not leave an external overlay pretending an online match is frozen. Prevent unsolicited About/store popups during active play.

Preserve existing XR/split-screen modes. New Tag split-screen and XR are not required for the first online release; show truthful availability and do not claim untested support. If implementing XR Tag, never override tracked head pose or apply forced roll/FOV changes. No new headset integration is required to complete desktop/mobile online play.

## 9. Authoritative online multiplayer architecture — mandatory

Keep the browser Three.js/TypeScript/Vite runtime. Host a separate authoritative Node/TypeScript match service. GitHub Pages may serve the static clients; it cannot be the persistent match-server process. Do not turn the project into a Unity WebGL migration or use a database/realtime broadcast channel as a substitute for authoritative high-frequency simulation.

Prefer Colyseus for room management, state synchronization, session lifecycle, and a version-compatible prediction stack, unless an inspected existing authoritative multiplayer service already fits. Validate current official documentation against the actual pinned server/client SDK versions. API/package names differ across releases; do not combine old examples with new netcode interfaces or copy a made-up API. Pin the compatible chosen versions and test them. Avoid adding a second synchronization/prediction system over one that already works.

### Authority and command protocol

The server owns all authoritative movement, role epochs, projectiles, tag collision, AI inputs, charges, burst meter, cooldowns, arena validity, timers, connection seats, and results. Clients submit bounded commands, not trusted transforms or hit/score claims.

Define versioned typed contracts for:
- `ClientCommand`: session/round binding, monotonically increasing sequence, intended simulation tick within a bounded window, throttle, steer, brake, hop hold/release edge, normalized/clamped aim, fire edge with unique action ID, burst edge, recover request.
- `RoomHandshake`: protocol, build, map, arena, rules, handling/controller version, collision hash, and supported tick configuration.
- `AuthoritativeSnapshot`: server tick, acknowledged input sequence, participant public state, relevant full owner rollback state, active role transitions, ammunition/Flow/cooldowns, projectile events/state, match stage and results.
- Reliable idempotent match events and action acknowledgements/rejections, separate from predicted effects.

Use server ticks for simulation. Reject non-finite numbers, oversized inputs, impossible action combinations, excessive tick lead, duplicate/stale action IDs, replayed commands from a previous round, invalid map IDs, and unauthorized control of another seat. Holding Fire may repeat at the configured cadence, but packet duplication must never create extra shots. Avoid unlimited catch-up bursts from buffered input after reconnect or a frozen tab.

Do not continuously broadcast the entire scenery or render transforms of every environment object. Send bounded participant/projectile data and events. Client-provided cosmetic IDs must come from an allowlist and cannot change collision or speed.

### Headless movement integration

Run the actual movement rules headlessly on the server with the same collision/nav fixtures and handling data as the appropriate client. Do not approximate the authoritative EUC as a separate 2D mover while the player predicts a different controller.

Extract or expose simulation contracts without importing DOM, audio, render textures, or WebGL constructors into the server. Shared numeric math modules are acceptable if they have no browser dependency. Verify the complete transitive import graph, not just the top-level file.

Prediction snapshots must include all relevant controller internals: velocities, steering/motor and balance state, grounded/airborne flags, hop charge/buffer, recovery, input rearm state, cooldowns, Flow, and any fixed-step accumulators that affect subsequent commands. Position/heading alone is not a complete snapshot. Purely visual spring/camera state may remain local if it cannot affect gameplay.

Test snapshot/restore by replaying the same input sequence after restoration and comparing states under defined tolerances. Verify client and server movement under the actual library/WASM versions and fixtures. Do not assume a physics library's determinism means arbitrary application initialization, floating math, RNG, scheduling, and collider insertion order are automatically identical.

### Timing and prediction

Start with a 60-Hz authoritative fixed room tick and roughly 20-Hz snapshot/patch publication. Where the existing controller needs 120-Hz movement, use exactly two 1/120 substeps per authoritative tick and mirror that contract in client prediction. These are engineering starting points; profile and version any deliberate adjustment. Never globally retime ordinary riding as a shortcut.

Use a fixed-step accumulator with bounded catch-up, overload metrics, and independent rendering. If the server cannot sustain a room, show degraded service and constrain capacity; do not silently enlarge the physics step until tags become incorrect.

Predict the controlled rider locally, retain a bounded unacknowledged input history, restore authoritative owner state, and replay only unacknowledged commands. Interpolate remote riders through a small bounded buffer, initially around 100 ms. Smooth visual correction separately from authoritative collision state. Define behavior for remote collision proxies during replay; don't accidentally replay bot decisions, tag awards, sounds, or rewards twice.

A local muzzle flash and predicted heart can appear immediately. Reconcile their IDs with server acceptance; rejected shots fade without awarding points or resetting server cooldowns. Only authoritative events confirm a tag or round result.

First release uses server-time projectile simulation with predicted visuals. Document the remaining high-latency disadvantage and show ping/service status. Do NOT claim full lag compensation if only interpolation is present. Any later projectile catch-up must sweep the historical flight interval against relevant historical rider positions and obstacles, with a bounded window and no impossible through-cover hits. Hitscan target rewind alone is not valid for finite-speed hearts.

### Online bot fill and room persistence

Bots exist as normal authoritative participants with server-generated inputs. Count them against eight active seats, not eight humans plus unlimited bots. Clients render snapshots and do not independently make bot choices. Practice/offline status is explicit and separate from an online session.

A lobby host can set rules before a round and start when requirements are met. The server checks role permissions, asset-ready state, seat capacity, and compatibility. When the host leaves, transfer lobby ownership; a dedicated server keeps the active match running. Initial hosting does not require peer-to-peer host migration.

Roster changes happen between rounds. Late joiners spectate or wait; reconnecting participants reclaim their existing seat. On an unexpected drop, reserve the seat for an initial 20-second grace period and switch that same rider to a clearly labeled server-controlled reconnect proxy using the same bot/controller rules. The proxy remains in the match, retains role/ammo, and may be tagged; disconnection is not an escape/invulnerability mechanic. On rejoin, restore the current state, not the pre-drop state. If a room disables bot takeover, leave a neutral/braked vulnerable actor instead; use one clearly documented policy.

After grace expiry or explicit leave, mark the departing human DNF/ineligible for a win. The same seat may remain as a labeled bot until the round ends; do not spawn another copy. Ensure Classic retains exactly one It and Spread cannot retain an unreachable ghost runner. A server restart ends in-memory matches honestly rather than pretending to resume them without persistence.

Use the chosen framework's tested reconnection mechanism and short-lived reservation credentials. Support automatic retry while the client runs and an explicit refresh/rejoin path. Rotate/store reconnect tokens appropriately; never embed them in invitation links or logs. A successful reconnect applies a fresh authoritative snapshot, acknowledges the new input epoch, clears stale command buffers, and restores one set of listeners.

### Invite and navigation flow

Generate cryptographically random room IDs and short room codes mapped on the server, with collision checking, expiration of idle rooms, and brute-force/rate protection. A room code is a discovery aid, not an admin credential. Exchange valid join requests for a scoped, short-lived seat token. Display names do not establish identity or host authority.

Invitation links preserve the deployed project's nested base path and carry only approved room/map/rules routing data or an appropriate scoped invite token. They must not include secrets, reconnect credentials, or an arbitrary backend URL parameter. Validate against an internal route/endpoint allowlist before navigation. Preserve the real Explorer `elmwood.html` entry when required. An invitation from the wrong product routes to the correct verified game entry and loads the room's map, or shows a useful mismatch message; it never joins mismatched collision worlds.

Make copy/share links actually work. Do not show 'Copied' unless clipboard/share succeeds; provide a selectable fallback. Show distinct unavailable, room-full, round-in-progress, expired-code, incompatible-build, and reconnect-expired states. Never redirect a failed online join silently into bots labeled as humans.

### Authentication, abuse prevention, and public readiness

Keep initial access simple with a server-issued guest session and a sanitized display name; no new account platform is required. Reuse secure existing auth if practical, but do not make an unrelated account migration a prerequisite. Bind socket commands to the authenticated seat, never a client-supplied player ID.

Validate Origin for WebSocket upgrades and appropriate HTTP CORS on actual deployed origins. Origin/CORS is not authentication. Secure administrative routes separately. Escape displayed names; limit input lengths and message sizes. Add session/IP creation limits, join-code limits, per-connection command limits with reasonable headroom for the fixed tick rate, room/capacity caps, and reconnect limits. Handle proxies correctly when using IP-based limits.

Keep signing keys, service credentials, operator tokens, and private logs server-side. No secrets in Vite-exposed variables or public configuration files. Protect metrics/admin panels. Strip secrets/tokens from logs. Keep a bounded operational event trail and define retention; do not collect unnecessary personal data.

Begin with private rooms and preset pings, not unmoderated voice/text chat. Public discovery is disabled until report/block behavior, host moderation, spam protection, operational monitoring, and an actual moderation process are available. A dummy Report button is not sufficient. Do not call the system cheat-proof: server authority reduces trusted client surface but still requires validation and monitoring.

## 10. Architecture and files: one Tag implementation, two adapters

Prefer existing compatible shared packages; otherwise create a small local shared package with explicit reproducible dependencies. Do not copy-paste divergent Tag engines into both games. Share pure rules first and keep render/map integration thin. Avoid multiple Three.js copies or competing animation loops in one client.

Suggested structure, subject to existing project layout:

```text
packages/tag-core/src/
  config.ts
  matchState.ts
  rulesClassic.ts
  rulesSpread.ts
  tagTransitions.ts
  loveGun.ts
  projectileSimulation.ts
  contactTags.ts
  eventOrdering.ts
  protocol.ts
  contracts.ts
  bots/perception.ts
  bots/decisions.ts
  bots/navigation.ts
  tests/

packages/tag-client/src/
  TagSession.ts
  OfflineTransport.ts
  OnlineTransport.ts
  inputBindings.ts
  predictionAdapter.ts
  projectileView.ts
  roleEffects.ts
  tagHud.ts
  tagLobby.ts
  assetManifest.ts

services/tag-server/src/
  server.ts
  TagRoom.ts
  guestSessions.ts
  inviteCodes.ts
  validateCommands.ts
  reconnectPolicy.ts
  headlessWorld.ts
  mapRegistry.ts
  health.ts
  tests/

<SWOOP_SOURCE>/src/detroit/tag/
  adapter.ts
  arenas/

<ELMWOOD_SOURCE>/src/tag/
  adapter.ts
  arenas/

scripts/
  export-tag-collision.mjs
  verify-tag-assets.mjs
  test-tag-multiclient.mjs

docs/love-tag/
  STATUS.md
  ARCHITECTURE.md
  TUNING.md
  ASSET_MANIFEST.md
  TEST_EVIDENCE.md
  ONLINE_SETUP.md
  DEPLOYMENT.md
  ROLLBACK.md
```

Do not create empty files just to match this tree. Every added module must have a real responsibility and functioning integration. Implement an offline transport/authority adapter and online transport behind an explicit session interface; they share rule code, not fictitious socket activity.

Map adapters provide terrain/normal samples, obstacle queries, safe anchors, nav graph, allowed surfaces, coordinate conversion, collision fixtures, controller creation/snapshot support, render attachment, input hooks, and cleanup. Use controlled exports and type checks; no global `any` bridge everywhere or circular imports.

Namespace Tag preferences and statistics by map/arena, rules version, and mode; preserve legacy saves untouched. Local results are clearly local and are never trusted as online leaderboard submissions. Round results use a server-generated ID and idempotent award/event handling. Session-only online results are acceptable initially when labeled as such; don't fabricate cross-device persistence or lifetime leaderboards.

## 11. Asset production: working visuals first, then polish

Reuse existing EUC and rider models, rigs, and animation where suitable. Tag's competitive vehicle is EUC-only initially; preserve bicycles outside Tag and defer mixed-vehicle balance. Do not use clothing differences to change speed/reach.

First playable assets:
- `love_gun_01`: original stylized toy-like launcher with grip and muzzle sockets.
- `heart_projectile_01`: clearly heart-shaped visual with cheap fallback rendering.
- Role badges/outline effects and world-space indicators.
- A small tag-impact heart ring and charge/empty feedback.
- Minimal arena boundary/spawn markers compatible with each map.

Use Blender to author or procedurally generate real meshes, normalize units/transforms/pivots, fit rider hand/grip poses, bake any necessary animation, simplify LODs, and export validated GLB. A simple complete heart mesh and launcher are better than invisible placeholders. Keep low-cost procedural fallbacks while polished assets load or fail.

Use Higgsfield for original concept art and motion-reference clips through an available authorized workflow. Those outputs are not automatically skeletal clips or game-ready GLBs. Do not claim a video is a rig or invent a generation job/model ID. Respect the user's spending authorization; prepare prompts/manifest entries when generation is not authorized.

Unity is a content-preview/validation stage when an appropriate installation is available, not the shipping game engine. Inspect scale, grip/aim pose, materials, and clip timing there if useful. Blender-authored GLB remains the canonical web artifact; do not assume Unity export preserves every shader, constraint, or animation without a validated exporter. No mandatory costly Unity migration.

Keep runtime asset keys stable, readable, and shared by both games. Lazy-load Tag assets. Preflight files, license metadata, external textures, compression loaders, and supported extensions for BOTH packaging paths. In particular, inspect Explorer's GLB/shared-texture processing before introducing a texture format or compression extension. An asset working in a viewer does not prove its packaged texture paths work.

Suggested initial budgets: launcher under about 6k triangles at near LOD, heart under 300 triangles, 1K-or-smaller launcher textures unless visibly justified, pooled effects, no per-heart lights, and limited transparent overdraw. These are review targets, not measured runtime limits. Keep collision proxies separate from visual LODs; quality changes cannot change competitive physics.

Use original sounds or licensed assets with provenance. Provide shot, empty, near-miss, confirmed-tag, transition, and finish cues; don't add continuous loud ambience to Explorer. No use of the user's likeness or a real person's portrait is required. Do not generate an AI cameo instead of actual player control.

## 12. Build, hosting, and configuration

Make the online server locally runnable and deployable as a separate long-running service. Provide a pinned compatible runtime, reproducible package scripts, lockfiles, non-root multi-stage container configuration where appropriate, small collision-data exports, health/readiness endpoints, graceful shutdown, and exact startup/test commands derived from the created project. Do not ship the whole art repository to the server just to obtain collision data.

Use one process initially if that is sufficient for the demonstrated capacity. Enforce room limits and advertise supported capacity honestly. Do not add distributed matchmaking, Redis, autoscaling, or multi-region costs without need. Document the later scaling boundary and that a room's authoritative simulation stays on one selected worker.

Proposed configuration names (adapt consistently and document):

```text
Public client runtime configuration:
  TAG_SERVER_URL          public HTTPS service base, not a secret
  TAG_ENABLED             feature availability
  TAG_PROTOCOL_VERSION
  TAG_BUILD_ID

Server-only environment:
  PORT
  TAG_ALLOWED_ORIGINS
  TAG_SESSION_SECRET
  TAG_MAX_ROOMS
  TAG_MAX_ACTIVE_PLAYERS=8
  TAG_MAX_SPECTATORS=4
  TAG_COLLISION_MANIFEST
  TAG_PUBLIC_MATCHMAKING=false
```

Create `.env.example` and a public runtime-config example with placeholders, not real credentials or fake live domains. If Vite build variables are used instead of runtime JSON, explain which configuration is baked and which requires a rebuild. For production clients use HTTPS/WSS-compatible transport, validate endpoint schemes/hosts, and never silently fall back to `localhost`. A user-supplied invite parameter must not override the backend destination.

Preserve nested GitHub Pages paths, asset bases, service-worker cache/version invalidation where applicable, allowed iframe interactions, and return navigation. The static client and match server have separate deployment/version lifecycles. The server handshake rejects incompatible builds/map fixtures with a readable update message.

Document HTTP authentication/matchmaking and WebSocket reverse-proxy upgrade handling, TLS termination, timeouts/heartbeats, graceful draining, protected operational metrics, and health checks. Do not assume ordinary short-lived HTTP functions are a suitable persistent room host without verified support.

Backend unavailable: the Online button explains the condition and allows retry or an explicit switch to Offline. Preserve working ordinary riding and offline Tag. Never advertise an online room when no backend connection exists. Internet deployment and hosting charges are separate from code-generation and art credits; provide no unsupported cost guarantee.

Use the existing staged/preflight build pipeline. Validate all source/assets/licenses before touching a last-good package. Add Tag assets and collision exports to dependency tracking. Test both packaged game entries independently. Preserve backups/rollback manifests and protect unrelated artifacts.

Prepare a staging configuration and deployment runbook, but deploy only with authorized credentials and explicit permission. If those are absent, mark `internet_staging_tested=false` and give the exact remaining command/configuration requirements. A local server can prove network implementation, not internet reachability.

## 13. Tests and measurable acceptance criteria

Implement unit tests, headless simulation tests, server integration tests, browser playtests, and the dual-game regression matrix. Use actual scripts and retain command/output evidence. Missing hardware or credentials are untested/blocked, never passed. Rendered WebGL screenshot evidence is required for UI/visual claims.

### Rules and physics
- Classic has exactly one It after start, tag, manual recovery, disconnect, reconnect, and round transition.
- Spread converts exactly once; final catch vs timer expiry has deterministic ordering.
- Role epochs invalidate stale projectiles and action IDs; no instant tag-back or repeat farming.
- A fast moving heart and rider crossing between steps still detect impact; a prior wall wins.
- No tags through floors, walls, height-separated paths, or a camera outside cover.
- Muzzle inside/behind obstruction cannot shoot through it; projectile range/lifetime and charge/cooldown enforce exact boundaries.
- Bots, spectators, nonparticipants, and decorative objects use intended collision masks.
- Same competitive tag volume and handling across cosmetics.
- Hop, burst, recovery, charge, pause, and reconnect cannot duplicate resource awards.
- Snapshot/restore/replay includes internal state and does not diverge unexpectedly.
- Leaving Tag restores non-Tag movement and original preferences.

### AI
- A bot can complete chase/escape loops on each actual arena using legal paths.
- Losing sight uses bounded last-known memory, not hidden coordinates.
- Reaction/aim limits differ by difficulty without changing physics/ammunition.
- Online bots make decisions on the server only and count against the room cap.
- Stuck handling is bounded and cannot warp bots through obstacles.

### Networking
- Two independently controlled browser clients join one actual server room and both observe authoritative movement/tags/results.
- Complete one online round per ruleset on EACH map; run mixed humans/bots and all-human cases.
- Test 0/80/150/250 ms simulated RTT and bounded jitter where tooling supports it; record actual settings, frame/room timing, rejected commands, and correction magnitudes.
- Test a five-second connection interruption and reconnect inside grace, then expiration beyond grace. No duplicate actors, listeners, shots, charges, or reset scores.
- Test packet delivery stalls with an appropriate network proxy; do not confuse TCP/WebSocket behavior with application-level datagram loss.
- Joining full/expired/incompatible rooms, late join/spectate, host departure, no-human cleanup, server shutdown, and rematch work.
- Cross-room input, spoofed seat, impossible speed/fire, duplicate messages, stale rounds, malformed payloads, and unauthorized host commands are rejected.
- Offline pause freezes the simulation; online menus do not.
- Wrong-map invites resolve to the correct verified entry or reject; clients cannot override the server's map.

### Browser/device and deployment
- Test desktop keyboard/mouse, gamepad where available, and touch layouts on portrait/landscape viewports.
- Confirm steering + aim + Fire work concurrently without pointer capture bugs or UI-click shots.
- Test each real packaged entry, not just a shared test scene.
- Validate Explorer's preserved touch editor and custom layout saves.
- Verify assets/textures through actual deployment-relative paths and failure fallbacks.
- Repeated join/leave/rematch/map-switch cycles do not accumulate callbacks, sockets, animation loops, or GPU resources.
- Record hardware/browser/viewport and median/p95 frame time; target 60 fps desktop and stable 30 fps on the selected mobile test device, without claiming universal device support.
- Profile an eight-rider room and document measured CPU tick headroom, bandwidth, and resource usage rather than declaring unmeasured server capacity.
- Before calling it internet-verified, complete a hosted WSS match from separate devices/networks. A two-tab localhost test is only the local network gate.

Use the companion acceptance matrix in this kit to track each target separately. Real-life playtesting of pursuit enjoyment remains necessary even when deterministic tests pass.

## 14. Phased implementation plan

### Phase 1 — functional offline Tag in BOTH actual games

Perform focused source discovery and baseline checks, reuse applicable earlier maintenance fixes only if still necessary, and implement shared match rules, Tag handling injection, a complete heart projectile, proximity tags, AI, menu/HUD, arena data, and finish/rematch/exit in both games. Use existing riders and low-cost complete visuals. Add actual tests and dual-game screenshots. Keep earlier community rides independent.

Phase 1 exit: one person can play a full match against bots on both packaged games and leave without corrupting normal play. Explicitly label online integration pending until Phase 2. This phase alone is NOT full completion.

### Phase 2 — real authoritative online play, both maps

Implement the headless map/controller adapters, server, guest sessions, create/join/invite lobby, snapshots and validated inputs, client prediction/reconciliation, server projectiles/bots, role transitions, late join, reconnect, results, rematch, and unavailable-service UI. Run two-client tests and measured network conditions separately per game and ruleset. Reuse existing art; do not postpone networking for visual polish.

Phase 2 exit: multiple independent clients exchange actual input/state with the server, complete verified online rounds, and handle disconnect/rejoin without diverging. Offline AI remains usable without the service.

### Phase 3 — controls, visual/audio polish, and fairness

Refine aiming/movement, bot behavior, tag readability, narrow paths/cover, touch/custom layouts, camera clearance, sound/motion accessibility, collision fairness, recovery anti-exploits, and performance. Produce validated Blender assets and approved Higgsfield/Unity reference/preview work when available. Missing optional paid art does not excuse broken gameplay; use working original fallbacks.

Phase 3 exit: actual screens and metrics support the claimed polish, both products keep their identity, and all regression tests remain green or explicitly blocked with evidence.

### Phase 4 — release preparation and hosted verification

Prepare clean reproducible builds, server/container configuration, public client configuration, secrets examples, TLS/proxy/health setup, version checks, rollback instructions, and the completed test matrix. With separately authorized staging credentials, perform real internet cross-device matches. Otherwise deliver deployable code and exact remaining setup, marking hosted verification blocked—not successful.

Public matchmaking is a separately gated follow-up after operational moderation/security readiness. Private internet multiplayer remains required for the core release.

`EXECUTION_SCOPE=CORE_RELEASE` includes implementation through Phase 4; paid provisioning and production deployment are never implicit.

## 15. Required deliverables and completion report

Deliver actual source changes for both roots and the shared/server packages, versioned arena/collision data, asset manifests and real fallback assets, automated tests, deployment artifacts, and documentation. If Explorer lives in another repository, include its patch/commit and exact dependency steps; a Jungle-Lotto-only generated-output patch is not enough.

Maintain `docs/love-tag/STATUS.md` after each milestone. It must include:
- Source roots/revisions and chosen dependency versions.
- Current phase and per-map/ruleset completion status.
- Implemented features vs placeholders vs deferred work.
- Exact commands run, results, screenshots/log locations, devices tested, and tests not run.
- Separate local-network and hosted-internet evidence.
- Missing assets/tool installs/credentials and their exact effect on completion.
- The next narrow runnable task, without rescanning or restarting the project.

Final response from Codex must list changed files, explain the working player flow, show how to run both games and the real server with the actual scripts, give test results by target, and state deployment status honestly. No fake links, invented tests, stock screenshots, fabricated player counts, or 'production-ready' claim while required gates are untested.

**Definition of done:** in each actual game, a player can open LOVE TAG, create or join a real online room, invite another independently controlled human, ride an EUC, evade and tag with hearts/contact, play alongside server-controlled bots when enabled, see synchronized roles/timers/results, reconnect correctly, rematch, and return to normal riding with settings intact. Offline AI works without the online server. Internet availability is claimed only after the hosted gate is verified.

## Reference notes for implementation

This prompt's mechanics and numeric settings are original proposed design targets. Prior project context comes from the shared Swoop/Elmwood brief and inspected build scripts. Current workspace source is authoritative if it differs; record the difference instead of blindly applying stale patches.

Consult the version-matched primary documentation before choosing APIs. Official references checked October 3, 2026:

```text
GitHub Pages hosting:
https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages

Colyseus rooms / state:
https://docs.colyseus.io/room
https://docs.colyseus.io/state

Colyseus fixed input / prediction / reconnect:
https://docs.colyseus.io/netcode/server-input
https://docs.colyseus.io/netcode/client-prediction
https://docs.colyseus.io/room/reconnection

Rapier scene queries / determinism:
https://rapier.rs/docs/user_guides/javascript/scene_queries/
https://rapier.rs/docs/user_guides/javascript/determinism/
```

The inspected live documentation includes APIs for newer releases than some current project packages. Documentation recency is NOT authorization for a broad engine/dependency upgrade. Match actual APIs, versions, typings, and tests first.
