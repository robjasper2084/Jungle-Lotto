# MASTER CODEX PROMPT — Mounted Combat & Selected-Wheel Performance
## BreadFlowerDos engine integration · Swoop Detroit · Elmwood Explorer · six-player STATIC ROYALE

Revision: V2, October 9, 2026.
Status: Implementation instructions. This revision does not implement game integration, generate assets, or deploy a server. The included prior input bridge remains an isolated proof, not the completed game.

```text
MERGE_SCOPE=CORE_RELEASE
COMBAT_PRESET=PUBG_INSPIRED_EUC
WHEEL_PERFORMANCE_POLICY=SELECTED_MODEL
ONLINE_COMBATANT_LIMIT=6
PRIMARY_RULESET=SOLO_ROYALE
```

## 0. Execution contract and precedence

Act as the gameplay/network engineer and technical animator for the existing projects. Implement the requested behavior in the actual source projects, using available tools and compatible existing assets. Do not stop after describing the design when implementation is possible.

The player must visibly hold the gun correctly, ride an electric unicycle, aim independently, fire travel-time projectiles with drop, reload, carve, hop, and compete against people or AI. Real six-human online play is mandatory. Apply shared improvements to BOTH Swoop Detroit and the separately packaged Elmwood Explorer. The downtown battle arena is a single shared destination launched from either product, not buildings inserted into the cemetery.

This document supersedes conflicting instructions in the older adaptation brief and merge prompt. In particular:

- Actual audited BreadFlowerDos C++/Wasm integration remains required; reference-only imitation is insufficient.
- Remove the obsolete universal 36 km/h combat and 47 km/h burst targets. The selected wheel's verified profile sets performance. Do not replace them with another universal arbitrary number.
- PUBG is a control/weapon-feel reference; Battlefield 2 is a mounted-combat, equipment, communication, and teamwork reference. Do not claim exact reproduction or copy proprietary game assets, animations, audio, code, UI, or balancing tables.
- Use already available, reusable combat animations where verified. Availability, ownership, free price, license eligibility, and successful retargeting are separate checks.
- Keep the default SIX-player solo battle royale. Do not silently replace it with teams, conquest, a walking shooter, or a larger lobby. Three duos is a separately selectable later preset, not a prerequisite for the first release.

Priority: this master; `04_COMBAT_HANDLING_ACCEPTANCE_TESTS.md`; remaining compatible engine acceptance tests; revised gameplay spec. Archived documents under `docs/legacy/` are historical only.

Do not delete working games, overwrite user changes, buy assets, run paid generation, install large applications, provision paid hosting, merge production branches, or deploy without authorization. Leave an actionable checkpoint when genuinely blocked. No invented passed tests or asynchronous completion promises.

## 1. Discover the real source, kit, and installed tools

Read applicable AGENTS.md, current Git status, manifests, lockfiles, source revisions, actual multiplayer code, and existing tests. Work on a nonproduction feature branch. Do not assume a previous prompt means that its features were implemented.

Known discovery targets, to resolve rather than blindly hardcode:

- Repository: `robjasper2084/Jungle-Lotto`.
- Base: `lottominded-ultra.io/games/gothtechnology2/`.
- Swoop editable source: `swoop-source/`.
- Packaging: `scripts/build-swoop-detroit.mjs` and `scripts/build-elmwood-explorer.mjs`.
- Explorer source: current `ELMWOOD_SOURCE`, explicit build argument, or configured `euc-detroit-riverwalk` source; its real entry is `elmwood.html`.
- Shared movement: the actual locally linked `@digital-static/ridecore` / `Digital_Static_RideCore` project.
- Existing bridge: `engine/src/input_bridge.cpp`, `engine/include/input_bridge.h`, `web/bridge.ts`, `dist/`, `tests/`, and `third_party/breadflowerdos/`.
- Actual Unity projects/editor versions, their Assets/ and Packages/ folders, and Blender executable/version/add-on configuration, only in accessible authorized project locations.

Swoop's internal `?map=elmwood` is NOT the separate Elmwood Explorer. Preserve and test the real Explorer build independently. Do not reconstruct missing source by modifying minified output or infer local paths from localhost URLs. Identify exact missing roots and continue useful shared work without marking a missing integration complete.

Use narrow inventory searches first. Avoid a whole-disk scan, executing arbitrary add-on code, or repeated broad scans of unrelated LottoMind projects.

## 2. Keep an honest actual-engine merge

The supplied prior bridge wraps real upstream `PlayerInput.hpp` at pinned commit `6b4d4e1f10dee9b1c8932db95f91b92e3eceb7db`. Run `node scripts/verify-source.mjs` and `node --test tests/wasm.test.mjs` from the kit before integrating. Historical evidence in the archive concerns only the isolated input proof; rerun and record actual outcomes.

The vendor directory is a subset, not a complete upstream checkout. Obtain/review additional upstream components at a pinned revision with retained notices. Keep a pristine reference and auditable patches. Inspect current source before assuming that upstream functionality is implemented: the pinned GameServer.cpp is commented scaffolding, not a functioning squad or multiplayer service.

Architecture ownership:

- Three.js owns web rendering, scene presentation, and cameras.
- RideCore owns movement/collision until a separately tested replacement is deliberately adopted.
- Actual compiled BreadFlowerDos components plus documented original C++ extensions own the selected engine-backed input/rules responsibilities.
- The authoritative online host authenticates participants, schedules simulation, transports commands/state, and invokes the engine-backed rules. It must not duplicate those same authoritative rules independently in TypeScript.
- Unity/Blender author and validate content. They do not become a second shipping renderer or physics engine for this request.

One scheduler, one movement owner, one collision world per simulation context. Use isolated Wasm instances/contexts per match, prediction world, and replay. Do not reuse process-global native input slots across concurrent rooms. The small freestanding header shims in the starter are not a general C++ SDK; expanded ports need an appropriate pinned supported toolchain.

Route real actions through compiled upstream functions and instrument the gameplay call path. Extend at least one meaningful engine-backed rules/lifecycle subsystem beyond input. Clearly distinguish reused upstream code from newly implemented behavior. Reject invalid action indices, especially upstream sentinel 64, before any shift/array access. Use a versioned checked ABI; never transmit native memory layouts, pointers, vtables, or unchecked raw structs.

Create OWNERSHIP.md and UPSTREAM_AUDIT.md showing which code owns each fact. Do not claim a working BF2 networking stack based on file names or declarations.

## 3. Inventory reusable animations before generating replacements

Create `docs/combat/ANIMATION_ASSET_AUDIT.md` and a machine-readable animation manifest.

Inspect accessible project `Assets`, `Animations`, `Add-Ons`, `Addons`, Unity package manifests/caches referenced by the project, Blender asset libraries/add-on configuration, and imported FBX/GLB files. Directory names are discovery hints, not claims that these folders exist. List metadata first and inspect only relevant candidate files. Read animation clips and actions, not only filenames.

For each candidate, record:

- Actual path, asset/clip name, hash, package/version, and source/vendor.
- License or entitlement evidence and suitability for this web game/export workflow. Mark unknowns pending rather than assuming that free means unrestricted.
- Skeleton type, bone mapping, rest pose, units, orientation, duration, frame rate, root motion, finger tracks, loops, and candidate gameplay states.
- Status: reusable as-is, needs retargeting, restricted, technically incompatible, or missing.

Prefer compatible existing combat/aim/reload clips and existing rigs over new characters. Use a compatible installed Unity Animation Rigging/retargeter or Blender workflow when verified. Prior mentions of Final IK, Cinemachine, or another plugin are not proof it is installed, owned, free, or contains animation clips. An add-on that performs rigging is not itself an animation pack.

Where authorized asset acquisition is needed, first verify a free source and its current terms. Mixamo is a possible humanoid animation source, not a claim of local availability. Do not log into accounts, accept terms, upload the custom character to an external service, or fetch paid assets without the required authorization. Never repackage licensed raw animation packs as a public download or public-repository source bundle merely because game use is permitted.

When no reusable clip exists, make an original procedural or keyframed upper-body pose/transition in Blender with an explicit placeholder status. Keep the real EUC lower-body motion. Never substitute walking, running, or foot-sliding infantry locomotion underneath a mounted rider. Missing polish may be recorded, but a visibly broken grip cannot pass the release gate.

## 4. Correct gun fit, hand contact, and aiming rig

The weapon must be held by the hands, not float near the body or attach to the wheel/camera.

Provide per-weapon/per-rider fit metadata, using stable sockets such as:

`weapon_grip_R`, `support_grip_L`, `muzzle`, `sight_axis`, `magazine_socket`, `holster_socket`.

Measure units, bone names, rest orientation, shoulder reach, grip offsets, wrist alignment, and muzzle/sight axes. Do not compensate for a wrong asset scale by extreme limb stretching. Fit the original man first, then approve each alternative rider/weapon pair. Unverified combinations are visibly unavailable, not silently broken.

Use a cycle-free rig dependency. A sound initial arrangement is: torso/aim animation drives the dominant arm; the weapon follows the dominant-hand socket; support-hand IK follows the weapon's left grip. If dominant-arm IK is added, drive it from an independent chest-relative aim target, never a target on a weapon that already depends on that same hand. Recompute transforms in a documented order; no circular constraints or one-frame hand lag.

For two-handed rifles, maintain believable trigger-hand placement and a supporting off-hand, stock/shoulder alignment, finger grip, and non-inverted wrists/elbows. Use elbow hints/pole targets. Pistols and other weapon families need their own fits; do not reuse a rifle pose indiscriminately. Keep fingers outside moving parts and no palms through the barrel. This is character-art validation, not a claim of real-world firearm instruction.

Rest stance is a stable low-ready/cradled hold. ADS raises the sight toward the eye line. The reticle, weapon axis, first-person optic view, and third-person pose must agree on the validated aim direction. Constrain torso yaw/pitch to reachable bounds; a rider aiming too far behind must turn rather than twist 360 degrees.

Respect weapon collision near walls. Raise/lower/obstruct firing appropriately without allowing a hidden muzzle to shoot from the camera. Cosmetic recoil cannot detach the gun or leave hands hovering.

During reload, the off-hand deliberately releases the foregrip, follows the reload motion, and blends back to support. It must NOT remain permanently IK-locked to the foregrip. Holstering, recovery, and severe crashes also require explicit constraint handoff. Retain the dominant grip while appropriate; prevent duplicate magazines and items floating through space.

Add a debug view of sockets, limb targets, weapon axes, reach, hand error, and foot contacts. Proposed release target: within 2 cm of defined grip contact targets during locked phases, with no visible penetration at normal gameplay distance. Specify intentional exemptions such as reload release; visual inspection remains required.

## 5. Layer movement, weapons, recoil, and IK correctly

Preserve the mounted movement layer for pelvis, knees, ankles, EUC contact, carving, braking, suspension, hops, and landings. Combat must not overwrite foot placement or drive a second character root.

Use masked upper-body states for low ready, hip fire, shoulder aim, ADS, shot recovery, reload, dry fire, weapon switch, and holster. Layer additive recoil and restrained movement sway in a documented local coordinate system, then solve hand contact using the updated weapon pose. Avoid applying the same recoil twice to weapon, arms, and camera.

Required demonstrable states include: idle, accelerating, braking, left/right carving, airborne, landing, aim transitions, semi-auto fire, supported burst/auto fire, partial/empty reload, interrupted reload, swap, crash/recover, and online remote playback.

Use additive clips only with a correct reference pose and matching bone tracks. Suppress root translation from imported combat clips. Keep normal walk/run animations out of the riding layer. Separate visual cue timing from gameplay authority: clip events cannot mint ammunition, decide a hit, or shorten reloads by changing animation playback speed.

Define reload phases and exactly when ammo transfers. Canceling before commitment cannot grant ammo; canceling after commitment cannot duplicate it. Fire, swap, death, disconnect, reloading while turning, and landing must have explicit transition rules. Blend support-hand IK weight around these phases.

In Unity, use appropriate Avatar Masks/layers and compatible rigging constraints. In Blender, retarget with actual bone maps, bake evaluated deformation-bone animation, and validate rest pose and contact points. Save editable source work and export named runtime clips plus sockets/fit metadata.

Unity Animator controllers, blend trees, Avatar Masks, and runtime constraint components are not automatically executable Three.js content. Export clips/metadata and implement equivalent masks, transitions, additive poses, and runtime IK in the existing web animation adapter. Baking one clip does not solve dynamic hand placement for all aim angles. Validate the exported GLB in BOTH real browser targets, not only Unity/Blender.

Higgsfield can supply approved original concepts or motion references. A generated video is not a rigged runtime clip. Do not spend generation credits automatically.

## 6. PUBG-inspired controls adapted for a wheel

Create a remappable COMBAT action context, retaining the user's existing noncombat bindings. This is an EUC adaptation, not a claim of exact PUBG parity.

Default desktop mapping:

| Input | Combat behavior |
|---|---|
| W / S | Accelerate / brake, with deliberate re-press before reverse |
| A / D | Steer the wheel, not instant sideways strafe |
| Mouse | Aim independently within rider/weapon bounds |
| Left mouse | Fire; held fire only for supported fire modes |
| Right mouse hold | Shoulder aim in the classic preset |
| Right mouse tap | Toggle ADS in the classic preset |
| R | Reload |
| B | Cycle supported fire modes only |
| 1 / 2 or mouse wheel | Deliberate weapon selection |
| Q / E | Bounded combat lean/shoulder behavior, not lateral teleport |
| Left Alt + mouse | Free look; preserve weapon aim unless explicit setting says otherwise |
| C | Mounted crouch/tuck, not standing infantry crouch |
| Space | Existing charged EUC hop |
| Shift | Flow Burst / acceleration boost within the selected profile |
| F | Interact / pickup |
| V | First/third-person camera when supported |
| Tab | Compact loadout panel; neutralize active controls |
| K | Combat Recover, with server validation |
| Escape | Release pointer lock/input and open menu |

R must no longer recover the rider in COMBAT context. Do not bind a critical action to a browser reload shortcut. Show active bindings in help and HUD. Resolve conflicts with existing tricks, ride-camera and photography commands through contexts, not destructive global remapping. Explain unsupported prone/vault actions instead of playing ground animations while mounted.

Implement right-mouse tap-versus-hold classification with a configurable threshold and tests; releasing after a hold must not also toggle ADS. Offer separate Hold ADS and Toggle ADS options. Scope suppression of browser context menus/selection to the canvas/controls, preserving text/chat accessibility. Chat, focus loss, pointer cancel, camera change, and device disconnect release movement/fire and require appropriate neutral rearm.

On gamepad, separate movement and right-stick aim while preserving brake/acceleration access. One usable preset: left stick steering/throttle with a dead zone, LT aim, RT fire, X reload, Y weapon switch, A hop, B tuck, LB burst, RB utility, D-pad context controls. Provide remapping and calibration. Free look must not become invisible aim control.

On touch, preserve Elmwood's movable/resizable/reassignable buttons, floating/fixed joystick and orientation-specific saves. Left movement region, independent right aim region, fire, aim, reload, brake, and hop must support concurrent touches with stable pointer ownership. Add a compact expandable utility group rather than cover the playfield. Mild configurable aim assistance may aid visible targets but cannot track through walls or override server aim limits.

## 7. Projectile shooting, recoil, and weapon weight

Implement actual time-of-flight projectiles with gravity/drop for the tactical projectile weapons. A tracer attached to an instantaneous hitscan result does not satisfy this request. Preserve clearly different Heartbreaker/Love Gun projectile tuning and mode effects; it may share the projectile framework, not identical velocity/drop/damage.

Create versioned data definitions for muzzle velocity, gravity scale, lifetime/range, collision radius, damage, magazine/reserve ammo, reload phases, supported fire modes, cadence, burst count, ADS transition, dispersion, recoil pattern, recovery, and attachments. Values are original game-balancing data, not claimed real weapon measurements or copied PUBG tuning.

Use units of meters, seconds, radians and radians/second where applicable. At each fixed substep, advance trajectory and sweep the swept volume to the next point; subdivide curved paths when needed rather than treating a whole ballistic arc as one straight chord. Account for moving target volumes and relative motion. The first blocking obstacle wins. No tunneling at high projectile or wheel speeds.

Compute initial velocity from the validated muzzle direction and weapon muzzle speed. Include the shooter's world velocity consistently when the profile uses velocity inheritance; document it and use the same coefficient on client and authority. Gravity is world-relative, not rotated by rider lean.

The camera selects intended aim. The projectile originates from the authoritative weapon muzzle, with close-wall obstruction. Derive that muzzle from shared rider/weapon fit metadata and authoritative bounded aim/lean, not an untrusted client bone transform or screen position. Do not run full visual skeleton IK on the server merely to authorize a shot; define a lightweight canonical pose/socket calculation and verify visual alignment to it.

Recoil is a reproducible per-weapon pattern plus bounded seeded variation. Player aim input can counter it. Apply controlled, bounded modifiers for wheel lean/angular velocity, rough ground, speed and airborne state; smooth these modifiers so camera jitter does not produce erratic recoil. ADS improves stability but does not remove all kick. Recoil affects aiming/dispersion in the defined space and must not steer or brake the wheel.

Define seed/counter authority for shot patterns. Client prediction cannot freely select a favorable recoil seed. Gameplay-relevant recoil must not reset on weapon swaps, ADS toggles or reconnects unless rules explicitly permit it. Keep purely visual camera kick distinct from authoritative shot direction.

Implement semi-auto edge detection, held-auto cadence, supported burst sequencing, dry fire, reload lockout, switch delay, ammo conservation, and deterministic cancellation. Lower frame rate or duplicate input packets must not create more bullets.

Provide readable hit direction, near miss, shield impact, health impact, dry-fire and reload cues. Hit markers/damage/eliminations require authority confirmation. No headshot multiplier is needed for this first pass; keep cosmetic rider variants competitively consistent. Preserve LOVE TAG role changes separately from Royale damage.

## 8. Selected-wheel speed and vehicle telemetry

The selected WHEEL is a gameplay vehicle choice; the selected RIDER appearance is cosmetic. Do not confuse either with visual mesh size. All eligible wheel models should be accessible on the same terms within a competitive room; no paid speed advantages.

Inventory the actual wheel selector, existing profile/catalog data, asset extras/manifests, and controller tuning. Establish stable wheel IDs shared by frontend, physics and server. Match the exact model/variant to a verified profile. Do not invent model names, speeds or installed assets.

For every wheel store: wheel ID/model/variant, asset ID, profile revision, source URL or trusted local provenance, verification status, speed basis, rated riding maximum, reverse cap, acceleration/braking limits, wheel radius, and suspension/handling parameters where available. Separate documented specifications from explicitly labeled gameplay estimates. Motor watts are not a speed value. Free-spin/unloaded speed is not interchangeable with a riding maximum. Treat unresolved values as unresolved.

Resolve missing real specifications from primary manufacturer information for that exact model where access is available, record date/variant/units, and disclose conflicts. Until resolved, keep a previously working explicitly labeled approximate profile or exclude that unverified model from verified-profile rooms. Do not silently assign every wheel the same guessed speed.

Convert once: km/h / 3.6 = m/s; mph * 0.44704 = m/s. Runtime controls, HUD, prediction, authority, bots, replay and speed warnings use the same versioned selected profile. The frontend sends a wheel ID; the server looks up permitted statistics. Never accept client-supplied maxSpeed, acceleration or wheel radius as authority.

Remove the earlier universal battle caps. With SELECTED_MODEL policy, the actual mounted vehicle must be able to approach that chosen profile's configured maximum under the specified test conditions. Do not merely change the displayed number or camera FOV. Flow Burst changes acceleration/response within that model's validated maximum unless an explicitly separate fictional-overdrive profile is approved.

Expose optional performance-normalized competitions only as a clearly labeled room policy; do not default to them in place of this requested selected-model behavior. A verified existing terrain, battery or incline effect can still reduce achievable speed and should be visible. Do not add fictional battery derating merely to hide a stale cap.

Wheel choice locks at ready/match start. Swapping models mid-round cannot replenish boost, health or ammunition. Share profiles across both actual games where their wheel selectors support them, preserve intentional mode restrictions visibly, and do not change bicycle/dog handling. Profile changes version records/ghosts so incomparable times do not overwrite legacy records.

Retest at the fastest permitted wheel, not a generic slow one: collision sweeps, substeps, braking distance, curvature limits, terrain samples, camera clearance, input latency, audio, animation speed and snapshot correction. Keep a stable fixed clock and bounded catch-up, not arbitrary extra simulation speed. If an arena is too small, revise allowed geometry/routes and record the release blocker rather than secretly slowing every wheel.

HUD speed comes from simulated world motion, with units shown. Wheel rotation follows traveled ground distance / actual radius, not a hardcoded spin animation. Log selected wheel, profile revision, target/achieved speed, throttle, brake and relevant limiting reason. Validate top speed on a sufficiently long, level, unblocked test lane with identical documented conditions and then in real gameplay.

## 9. BF2-style structure without inventing finished BF2 systems

Separate rider actor, EUC vehicle, weapon, shield/integrity, inventory, mount relation, bot controller, and presentation through existing component boundaries. Stable IDs and the mount relationship synchronize together; cosmetics never determine physics values. Actual engine-backed lifecycle/rules must participate in gameplay.

Give combat tactical readability: purposeful loadouts, ammunition limits, equipment feedback, clear hit direction, solid cover, spatial weapon/wheel sounds, a compact minimap, deliberate resupply opportunities, and readable match objectives. Implement pings with line-of-sight/cooldown rules, not permanent wallhacks.

Keep six-player solo battle royale primary: one life, last survivor, server-timed shrinking Static Field, safe spawns, loot, elimination, spectating, results and rematch. Preserve the current original arsenal, extending it with the verified animation/ballistic families needed for tactical gun feel rather than adding dozens of weapons.

A squad concept is gameplay/permission state, not a networking transport. Build squad membership/pings as new tested rules where needed; the incomplete upstream server cannot be reused as finished squad networking. An optional THREE DUOS preset can use team markers, teammate pings and explicit friendly-fire settings after the solo release passes. Do not require a commander, aircraft, tanks, conquest tickets, dismounting, or building-wide destruction for completion.

There are SIX active combatants total. Bots occupy slots, spectators do not. Human-only rooms await six ready humans; mixed rooms label AI and total six. No fresh combatants mid-round. Preserve offline 1+5 practice and separate LOVE TAG rules. No stakes or unvalidated conversion to LottoMind credits/store discounts.

## 10. Server authority, high-speed synchronization, and fairness

Reuse the real authoritative online service where suitable; otherwise implement a compatible pinned server transport/room host. A relay, localStorage bus, split-screen view or input-only Wasm proof is not online authority.

Pipeline: authenticated sequenced actions -> compiled engine input -> fixed-step RideCore movement -> canonical mounted pose/muzzle and collision queries -> engine-backed weapon/rules update -> trusted hit resolution -> health/zone/elimination -> versioned authoritative snapshots. Define and test exact substep order; avoid both TS and C++ independently owning health/ammo/damage.

Server owns roster, wheel/loadout allowlist, simulation time, movement validation, aim bounds, shot ID, recoil state, ammo/reload, damage, pickups, zone, bots and outcome. Validate finite inputs and integer sequences before JS/Wasm coercion, message size/rate, session/slot ownership, duplicate edges, age and bounded queues. Clients send actions, not accepted hits, transforms, damage, statistics or victory.

Use local movement prediction, reconciliation and remote interpolation with full controller snapshot/restore, including hidden motor/brake/hop/recovery/boost state. Synchronize weapon state, reload phase/start tick, weapon ID, shot counter, wheel profile, bounded aim and transition state. Clients reconstruct visual animation, not send every bone transform. Test clip speed variations without changing reload authority.

Use the same protocol, bridge ABI, engine/module hash, weapon definitions, wheel catalog/profile, physics configuration, map revision and collision artifact for a room. Reject incompatible clients clearly. Current state and statistical metadata must distinguish intentionally different wheel performance from cosmetic differences.

Start from the existing fixed-step schedule; evaluate 60-Hz authoritative updates, necessary physics substeps and roughly 20-Hz published snapshots by measurement. Do not claim these numbers guarantee good performance. Plan bullet sweeps/substeps according to fastest relative movement, not visual FPS. No simulation-time advancement from client dt.

Predict shot visuals immediately but reconcile to server projectiles. Begin with honest server-time travel validation. Add historical compensation only with bounded replay of projectile trajectory plus matching obstacle/target timeline; instantaneous target rewind is not sufficient for a curved traveling projectile.

Process same-tick damage consistently before final victory; simultaneous elimination of the last riders has a defined draw. Reconnect restores identical wheel, health, ammo, reload phase, role/alive state and inventory; no resurrection, immunity or free supplies. During dropout, neutralize inputs but retain vulnerability and expire the seat according to rules. Online menus do not pause the room. Owner departure does not kill a dedicated match host.

Private create/join/invite/ready/start/results/rematch/reconnect must work. Invite links never contain session/reconnect secrets. Use HTTPS/WSS, origin checks, short-lived identity tokens, health checks and safe diagnostics when hosted. Restrict spectator information to avoid live scouting. Do not auto-deploy or create paid services. Missing hosting authorization blocks hosted verification, not runnable client/server implementation.

AI uses the same actual controller, wheel profiles, weapon rules, trajectories, reloads, perception limits, cover/nav data and zone rules. Improve skill through bounded reaction/aiming/decisions, not hidden speed boosts or knowledge through buildings. Online bots run only on authority; offline practice uses the same rules locally.

## 11. Both products, downtown, camera, and preservation

Build one canonical compact downtown-inspired arena with connected cover routes, corners, limited elevation and multiple exits. The selected-wheel maximum may require revised lengths/clearances; do not blindly reuse an older fixed map-size target. Safe-zone candidates must remain reachable via wheel-valid paths as the field contracts. No building-only or inaccessible-rooftop finales.

Expose the same downtown mode from Swoop and real Elmwood Explorer with correct return URLs and preserved context. Shared weapon/animation/input fixes apply to the actual modes using them. Do not force a gun into peaceful exploration, replace the cemetery or remove community rides, bicycles, companions, weather, photos, saves, LOVE TAG, existing split-screen/XR, or other working content.

Restore controls and normal session settings on exit. Preserve independent touch customization. Fix foliage camera obstruction, black/unreadable rider materials, browser selection popups and panel overload before expensive effects. Graphics quality may simplify decoration but cannot remove tactical cover or change hit testing. Preserve XR head tracking without forced roll or recoil camera shake. Do not claim untested XR or split-screen combat support.

Use small asset manifests, shared textures, honest LODs, bounded projectile pools and effects. Verify each build's image/GLB processing supports the final export formats. Preflight source, assets and licenses before cleaning output; build to staging with rollback. Desktop authoring success does not prove browser integration success.

## 12. Ordered implementation and required deliverables

Implement in tested increments, preserving a usable checkpoint:

1. Audit actual source/bridge/online status, tools, available combat clips and wheel catalog; run baselines and proof checks.
2. Fit one actual weapon to the original rider; prove two-hand contact, ADS and reload releases in a controlled rig scene AND both real browser adapters.
3. Implement combat action context, masks/runtime IK and weapon state machine; preserve existing controls outside combat.
4. Implement server-owned ballistics/recoil/reload and selected-wheel performance, including high-speed collision and snapshot tests.
5. Complete engine-backed six-player Royale with downtown integration, bots and real independent clients.
6. Polish approved additional riders/weapons, both builds, target-device performance and authorized hosted-internet tests.

Do not stop at step 2 and call the requested release complete. If missing tools or source prevent completion, continue independent work and record a precise blocker, not fake output.

Required files, adapt paths to existing equivalent modules rather than duplicate them:

- `docs/combat/STATUS.md`, `OWNERSHIP.md`, `ANIMATION_ASSET_AUDIT.md`, `RIG_REPORT.md`, `WHEEL_SPEED_AUDIT.md`, `CONTROLS.md`, `BALANCE.md`.
- Actual source changes in each project/shared core and engine fork, with versioned weapon definitions, wheel profiles, fit metadata and clip mapping.
- Repeatable available-tool animation processing/export scripts plus editable Blender/Unity source where actually produced; no claimed .blend/.unity files that were never created.
- Unit/integration/network tests and scripts runnable in the project's pinned toolchain.
- Reproducible staging builds, environment examples without secrets, and actual evidence per target.

Use `04_COMBAT_HANDLING_ACCEPTANCE_TESTS.md` and the engine acceptance matrix. For each test record target, source revision, command, actual result, evidence and blockers. Keep historical isolated-proof results separate from new game results. No spending assumptions about the earlier 500-credit budget.

Final success: the real hero holds and operates the weapon without floating or broken limbs while riding at the selected wheel's actual configured speed; aiming and steering remain independent; projectile/recoil/reload outcomes are authoritative; six humans can complete the same downtown Royale; both actual games remain functional afterward.

## Primary documentation and references

These are verification sources, not proof that any package, asset, or integration is installed. Check APIs for actual pinned versions, and preserve original/proprietary content boundaries.

- PUBG official basic controls (older documented baseline, not a full current keymap guarantee): https://support.pubg.com/hc/en-us/articles/360002074913-What-are-the-basic-game-commands
- Unity animation layers: https://docs.unity3d.com/6000.0/Documentation/Manual/AnimationLayers.html
- Unity Two Bone IK (choose installed compatible package version): https://docs.unity3d.com/Packages/com.unity.animation.rigging@1.2/manual/constraints/TwoBoneIKConstraint.html
- Blender glTF animation/baking/export documentation: https://docs.blender.org/manual/en/5.1/addons/import_export/scene_gltf2.html
- Adobe Mixamo usage FAQ: https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html
- BreadFlowerDos source: https://github.com/kiwidoggie/breadflowerdos
- Pinned input code: https://github.com/kiwidoggie/breadflowerdos/blob/6b4d4e1f10dee9b1c8932db95f91b92e3eceb7db/src/dice/hfe/io/PlayerInput.hpp
- Pinned unfinished server: https://github.com/kiwidoggie/breadflowerdos/blob/6b4d4e1f10dee9b1c8932db95f91b92e3eceb7db/src/dice/hfe/GameServer.cpp
