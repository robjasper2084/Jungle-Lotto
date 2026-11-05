# SWOOP: STATIC ROYALE — six-player EUC battle royale

Revised October 9, 2026 for actual engine integration. Working title. This is a proposed design and Codex implementation brief, not completed code, generated artwork, a playable build, or a deployed service. All numeric values below are provisional playtest settings.

## Execution contract

Build an original, movement-first electric-unicycle battle royale in the user's existing Swoop Detroit ecosystem. Six active combatants fight while remaining mounted on their EUCs in a compact downtown Detroit-inspired arena. Preserve the original human hero and existing alternative riders; cosmetic selection must not change competitive hitboxes. Keep LOVE TAG as a separate ruleset, and preserve normal Swoop riding and the separately packaged Elmwood Explorer.

Reference project: kiwidoggie/breadflowerdos. The user now requires ACTUAL engine integration. Follow `01_ENGINE_MERGE_MASTER_PROMPT.md`: port real audited C++ components through a tested compiled bridge, document newly authored extensions, and retain one rendering and physics owner. Do not treat incomplete upstream server scaffolding as working multiplayer, copy proprietary game assets, or call the supplied input-only proof a completed merger.

Real six-human online play is mandatory for completion. Offline bots, two browser windows, a UI with room buttons, or a design document are not substitutes. AI practice and optional mixed human/bot rooms are also required. Do not claim an existing LOVE TAG prompt proves that its server or gameplay was implemented.

Default scope: a complete first playable release comprising a downtown arena, core riding combat, shrinking zone, elimination/winner rules, private room codes, six-human capacity, bot practice, and both launch integrations. Develop in incremental tested checkpoints. Do not deploy, provision paid hosting, purchase assets, or run paid generation without authorization. Preserve unrelated changes and user saves.

## 1. Discover the actual workspace

Read applicable AGENTS.md files, package manifests, lockfiles, multiplayer entry points, existing tests, and current packaging scripts. Start in:

- Repository: robjasper2084/Jungle-Lotto.
- Product base: lottominded-ultra.io/games/gothtechnology2/.
- Swoop source: swoop-source/.
- Swoop build: scripts/build-swoop-detroit.mjs.
- Explorer build: scripts/build-elmwood-explorer.mjs.
- Explorer source: resolve the current ELMWOOD_SOURCE/explicit build argument and external euc-detroit-riverwalk project; do not guess an absolute path.
- Shared movement: inspect the locally linked @digital-static/ridecore dependency and its real source.

The Swoop package inspected for this brief lists Three.js, Rapier, TypeScript/Vite, and a local RideCore dependency. Recheck versions rather than upgrading wholesale. Keep the existing renderer, one movement owner, and established fixed-step scheduling. Actual C++/WebAssembly component integration is now required as specified in the engine-merge master. Do not add a second renderer, migrate to Unity/Unreal, or replace working physics without proven parity.

Editing Swoop's internal Elmwood map is not the same as updating the separate Elmwood Explorer. Both products should expose the new downtown match entry and share applicable control/network fixes. The playable downtown arena can be a single canonical route loaded by either entry, not two duplicated cities. Preserve each product's return path and preferences; do not insert downtown buildings into Elmwood's cemetery environment.

If external sources are missing, identify exact blockers and produce changes only where sources are available. Never reconstruct an external source project by patching minified output. Record source revisions and actual integration status per target.

## 2. Minimum product and match rules

Working title: SWOOP: STATIC ROYALE.

- Default competitive mode: six-player solo free-for-all battle royale.
- Exactly six active combatant slots in a full match. Bots count toward six; never six humans plus additional combat bots.
- Human-only rooms wait for six ready players unless the room explicitly selects a clearly labeled smaller private practice configuration.
- Bot-fill rooms can launch with humans plus labeled AI totaling six. Offline practice uses one human and five bots.
- Bot fill is opt-in and visible. Do not silently replace a human with a bot.
- No mid-round fresh combatants. Late joins spectate, subject to a separate bounded spectator capacity, or wait for the next match.
- One life per round. Eliminated players spectate or return to the lobby; no respawn, revive, or gulag system in the first release.
- Winner: last surviving rider after authoritative same-step damage resolution. Simultaneous final elimination has an explicit draw outcome, not arrival-order-dependent victory.
- Target active round: roughly five to six minutes. Use a hard final-zone deadline so matches cannot stall indefinitely.
- Preserve a separate LOVE TAG mode: no accidental role transfer/infection in Royale, and no Royale health elimination inside Tag.

Lifecycle: lobby -> ready check -> load/compatibility confirmation -> protected deployment -> active -> shrinking-zone phases -> final showdown -> results -> rematch/cleanup.

Start everyone on a working EUC with the same basic weapon, 100 rider integrity, 50 shield, and usable ammunition. Drop six participants into separated ground-level start bays; no parachute sequence is required. Starting protection is brief, clearly visible, and prevents firing while protected. Validate fair spawn spacing and access to equivalent early supplies.

Keep victory based on survival; kills, damage, riding distance, and accuracy are secondary statistics. Avoid monetary stakes, automatic store-credit conversion, and unvalidated reward bridge calls.

## 3. Mounted combat is the defining mechanic

The rider must accelerate, steer, brake, coast, hop, burst, aim, fire, and switch weapons without dismounting. Do not turn the avatar into an ordinary walking shooter with a wheel attached.

Separate body/vehicle heading from aiming. Use a bounded upper-body yaw/pitch and clear reticle. When a requested shot exceeds the allowed arc, explain that the rider needs to turn; do not permit torso twisting through a full revolution. Mouse aiming cannot silently steer the wheel.

Retain feet/pedal contact, believable knee compression, upper-body balance, and a firing pose fitted to each approved rider. Make the weapon appear in a consistent socket. Cosmetic accessories never enlarge damage volumes.

Use a versioned BATTLE_HANDLING profile rather than changing Free Ride, community rides, racing, or Elmwood settings globally:

- Starting cruising/top combat speed target: approximately 10 m/s (36 km/h).
- Brief forward Flow Burst cap: approximately 13 m/s (47 km/h), around 0.6 s.
- Strong but controlled braking; smooth acceleration onset.
- Speed-dependent steering: tight turns cost speed. No instantaneous full-speed reversal.
- Buffered, charged hop with approximately 0.5–0.75 m level-ground clearance.
- Limited midair correction and clean-landing momentum retention.
- Small impacts cause a scrape/slowdown; major impacts cause brief recoverable disruption, not repetitive cinematic ragdolls.
- Burst consumes a movement-energy meter, never rider health or the battery required for basic movement.
- Ordinary weapon hits do not repeatedly stun, lock steering, or immobilize the wheel.

Use one combined rider integrity system plus shield. Do not add separately destructible wheels that leave participants permanently immobile in a wheel-only game. Design any wheel damage as readable cosmetic feedback in the first release.

Recover is server-owned, nearby, and does not heal, clear debuffs, restore loot, reset ammunition, grant repeat immunity, bypass buildings, or move the participant across the Static Field. Recover cannot resurrect an eliminated rider.

## 4. Weapons, pickups, and movement pressure

Implement three original weapons through shared data definitions and projectile/hit-query interfaces:

1. Static Blaster: reliable medium-range energy fire, default starting weapon. Initial prototype: 20 damage, 0.45 s fire interval, moderate travel speed and range. Tune after measuring actual hit rates.
2. Heartbreaker: a Love Gun-derived heart projectile with lower cadence and stronger individual impact. In Royale it damages shield/integrity; it does not transfer Tag roles or home around obstacles. Use its own mode-specific definition.
3. Bass Cannon: short-range burst/pellet energy weapon rewarding close controlled passes. Aggregate per-shot damage is capped; one target cannot receive duplicate awards from repeated collision callbacks. No damage through walls.

Every weapon needs explicit damage, cooldown, ammo, projectile lifetime, speed, collision radius, and weapon-switch timing. Limit to two weapon slots and one utility slot. Use a small interaction radius and safe drive-by pickup behavior; do not require stopping to navigate an inventory grid. Swapping a full slot is deliberate, not an unwanted auto-replacement.

Shared rules:

- Emit shots from authoritative muzzle position, not from the third-person camera.
- Sweep projectiles over their complete traveled segment and respect earliest solid impact.
- Validate owner, cooldown, ammunition, alive state, weapon, aim bounds, and shot sequence server-side.
- No headshot multiplier in the first release; test body-volume fairness across inputs and avatars.
- A hit on another rider is damage, not a default high-speed crash or instant elimination.
- Predicted firing effects may be immediate, but hit confirmation and elimination feedback follow server confirmation.
- Process same-step damage and eliminations consistently, then freeze the match at its terminal outcome; specify how projectile cleanup occurs.

Shield can regenerate slowly after a clear no-damage interval; integrity needs a limited repair pickup. Static Field damage bypasses shield and escalates enough that hiding/healing outside the zone cannot win. Repair cancels when fired upon or attacking and cannot out-heal final-field damage.

Add one optional high-risk supply relay: a short activation awards a limited utility or repair item while making that location conspicuous. It draws opponents together without becoming a separate capture-point victory mode. It must not be required to win or snowball a permanent damage advantage.

Optional utilities can include a brief front shield that prevents firing while active, or a carefully bounded information pulse. Start with one implemented utility, not an entire class system. Defer full hero classes, sniper one-shots, airstrikes, tanks, aircraft, wall running, and fully destructible buildings.

## 5. Build a compact downtown arena

Create an original downtown Detroit-inspired district, roughly 400–500 m across as an initial blockout target, then tune from travel/encounter measurements. Prioritize several connected blocks over the whole city. This is a new arena, not an assertion that the existing Dequindre Cut or Elmwood map already contains downtown.

Use the feel of the Campus Martius/Woodward area as architectural and urban-layout reference. Compressed streets, new ramps, fictional combat props, and shortcuts must be labeled as creative adaptation rather than survey-accurate geography. Use original signage and cleared or original artwork; do not assume reference photographs are licensed textures.

Suggested gameplay spaces:

- Central plaza: open choices, cover islands, useful late-circle showdown geometry.
- Boulevard loop: fast circulation, intermittent solid cover, escape branches.
- Service alleys: tight braking and flank routes without unavoidable dead ends.
- Parking-ramp segment: limited elevation, multiple exits, no invulnerable rooftop position.
- Courtyard/arcade passage: sheltered path with sightline breaks and access back to the loop.

At least two accessible approaches or exits for each strategically valuable position. Test wheel clearance, turning radii, slopes, curbs, underpasses, camera clearance, and collision fit. Keep the skyline mostly noninteractive; do not create fully explorable skyscrapers for the first map.

During matches, civilian crowds and pets do not participate in combat or block its outcomes. Preserve them in existing noncombat modes. Small original breakable props may be added later through authoritative state changes, not a full destruction engine.

## 6. Static Field: the battle-royale pressure system

A readable boundary closes over several server-timed phases. Show the current boundary, next safe area, countdown, and route cue. Use a light holographic/static effect; do not obscure the roadway with thick fog or flashing post-processing.

Early stages allow exploration and flanks; later stages concentrate remaining players. Initial round structure: opening supplies and first engagements, two mid-round contractions, then a small final showdown by roughly six minutes. Final damage must prevent indefinite survival outside the safe area.

Generate zone centers only from validated candidates on the arena's traversable network. A mathematically nested circle is not enough: test connectivity, ground coverage, accessible ramps, usable cover, and travel time from permitted prior positions. Reject building-only, water-only, unreachable-roof, or disconnected final zones. Avoid shrinking toward a location whose only approach has become impossible.

The server owns seed, phase, center, radius/polygon, transition time, and damage. Clients interpolate visuals, not health loss or schedule decisions. Zone events must replay identically for all clients.

## 7. Online multiplayer and AI

Inspect existing online systems before selecting dependencies. Extend any verified authoritative LOVE TAG/RideCore service where appropriate. Otherwise implement a TypeScript/Node authoritative host with a suitable room framework such as Colyseus, invoking isolated engine-backed C++/Wasm rules rather than duplicating their authority in TypeScript. Pin mutually compatible server/client packages and use documentation for those versions. A pure relay is not authoritative game simulation.

Separate six combatant slots from network connection count: bots consume a combatant slot without a socket; bounded spectators may have sockets without active combatant slots. Test the seventh combatant rejection and all human/bot combinations.

Required flows: create private room, copy room code/link, join the correct arena, ready, load verification, match, results, rematch, quit, and reconnect. Public quick play can be gated until basic abuse protections exist, but private six-human internet play is mandatory.

The authoritative service owns:

- Simulation time and movement validation.
- Health/shields, ammunition, pickups, cooldowns, and utilities.
- Projectiles, collision, damage, eliminations, and winner.
- Zone state and deadlines.
- Bot state, decisions, and input.
- Match membership and reconnect identity.

Clients send sequenced inputs, not claimed hits, positions, inventory, damage, or victory. Reject malformed or out-of-range values, NaN, infinities, implausible sequence jumps, duplicate fire edges, replayed pickups, and rate floods. Enforce bounded message sizes and command queues. Matchmaking/session tokens and service secrets never belong in client source or invitation URLs.

Use fixed-step simulation, local prediction/reconciliation, and remote interpolation. Start by evaluating 60-Hz authoritative updates with the existing EUC controller's necessary substeps and approximately 20-Hz snapshots; profile rather than promise capacity. Correct replay requires full hidden controller state, not only position and speed. Extract snapshot/restore for motor, brake, hop, ground, recovery, and relevant effects. Keep collision data, coordinate transforms, handling versions, and action semantics compatible between server and client.

Version the handshake by map ID, arena revision, rules, protocol, physics, and collision artifact. Do not connect mismatched worlds and hope positions align.

For projectile weapons, begin with honest authoritative travel-time validation and predicted visual handoff. Do not apply instantaneous target rewind as a substitute for projectile history. Any later lag compensation needs bounded replay through the relevant obstacle/target timeline. Describe high-latency tradeoffs and test them.

A reconnecting participant retains the same entity, health, ammunition, alive/eliminated status, and inventory. Loss of input brakes/neutralizes safely but does not freeze the world or grant invulnerability. After the configured grace interval, eliminate disconnected active riders rather than creating an immortal empty seat. No late resurrection. Room-owner departure must not terminate the dedicated server process. Spectators cannot issue gameplay commands or see unrestricted information that assists live participants in competitive rooms.

Bots use the same controller, weapons, vision/last-seen information, zone knowledge, and pickup rules. Make difficulty change decisions, reaction delay, route prediction, and aiming error—not hidden health, extra movement speed, unlimited ammo, or perfect tracking through walls. Run online bots only on the server. Offline practice should reuse the same simulation/rules through a local session adapter.

## 8. Controls, art, and preservation

Retain keyboard, touch, and gamepad support. Use independent steering and aiming on touch with stable pointer ownership. Provide suitable remapping and preserve Elmwood's movable/resizable/reassignable touch layouts. Chat/menu focus releases held movement and fire. No browser long-press selection on the gameplay controls; ordinary form fields remain editable and accessible.

Fix the previously discussed camera obstruction, dark rider readability, intrusive HUD, and gesture issues before escalating effects. Competitive settings must not remove solid cover or reveal players who are hidden by gameplay-authoritative occluders. Quality scaling may change decoration, not tactical collision geometry.

Higgsfield: original appearance concepts and motion reference only unless a verified output pipeline supports more. Video output is not automatically a rigged game animation. Blender: real meshes, pivots, sockets, rigs, baking, LODs, export and validation. Unity: optional preview/QA for assets, not shipping-engine migration. Do not spend generation credits or install large applications automatically.

Reuse existing hero, EUC, shaders and sounds where licensed and appropriate. Create only the initial downtown blockout, three weapon visuals, hearts/energy shots, shield, field markers, pickups, and UI. Start with simple honest prototypes; do not present them as finished licensed downtown assets.

## 9. Delivery and evidence

Suggested new responsibilities, folded into existing modules when available:

- combat/rules, weapons, projectiles, damage, and loadouts.
- royale/match, six-slot roster, storm, loot, spawns, elimination, results.
- ai/arena navigation, perception, pursuit/evade, and tactics.
- maps/downtown adapter and versioned collision/nav artifacts.
- online/BattleRoyaleRoom and session integration.
- ui/royale HUD, lobby, results, and accessibility.

Keep effects/rendering out of the rules core and avoid duplicating Three.js versions across workspaces. Add no second render loop or competing controller. Preserve LOVE TAG's rules instead of hardcoding Battle Royale behavior into shared projectile callbacks.

Milestones:

A. Follow engine milestones M0/M1 first: provenance/portability and actual compiled input wiring in both games; then build the offline six-slot prototype with documented engine-backed rules and a greybox downtown arena.
B. Mounted shooting, balanced traversal, shield/damage, loot, Static Field, elimination and results.
C. Real server/client integration with six independent human clients, mixed-room tests, reconnect and hosted-internet verification.
D. Final initial art, camera/input polish, independent build verification for both product launch paths, regression and performance report.

Milestones A/B do not complete the user's online request. Distinguish local-network tests from actual hosted tests on separate networks. Missing deployment authorization is a blocker to hosted verification, not a reason to omit functional server/client code.

Preflight sources/assets/licenses before cleaning output. Build to staging, preserve the previous working packages, and require explicit deployment authorization. Provide exact changed files, commands, tests, results, screenshots, source revisions, missing dependencies, and an actionable continuation file. Never claim that code was built, tests passed, models were generated, or rooms were hosted without direct evidence.

See `02_ENGINE_MERGE_ACCEPTANCE_TESTS.md` for release gates and the new engine master for ownership, provenance, portability, and required engine-runtime evidence. This specification is subordinate to that master.
