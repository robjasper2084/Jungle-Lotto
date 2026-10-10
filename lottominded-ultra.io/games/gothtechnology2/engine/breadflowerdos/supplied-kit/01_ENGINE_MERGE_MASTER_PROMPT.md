# MASTER CODEX PROMPT — Actual BreadFlowerDos engine merge
## Swoop Detroit + Elmwood Explorer + six-player STATIC ROYALE

Prepared October 9, 2026. Default `MERGE_SCOPE=CORE_RELEASE`.

## 0. New direction and priority

The user explicitly requested: **use the actual engine to merge them**.
Integrate actual BreadFlowerDos C++ code into the shared Swoop/Elmwood game stack,
then extend the engine integration to power the six-player downtown mounted-combat
mode. This overrides the previous reference-only instruction and the prohibition
on C++/WebAssembly work. It does NOT authorize deleting either working game,
replacing all art, publishing a release, or spending money.

Priority within this kit: this document, then `02_ENGINE_MERGE_ACCEPTANCE_TESTS.md`,
then `03_STATIC_ROYALE_GAMEPLAY_SPEC.md`. The gameplay spec has been revised to remove
its previous anti-integration clauses. Do not feed the old adaptation brief back in
as higher-priority instructions.

Implement actual code where sources and tools are available. Do not deliver only
a design discussion, a renamed engine, or a TypeScript imitation while claiming
that BreadFlowerDos itself was merged. Conversely, the supplied small input proof
is NOT enough to declare the full engine/game integration complete.

## 1. What already exists in this package

Read `README.md`, `THIRD_PARTY_NOTICES.md`, and `evidence/` before editing.

The supplied bridge includes unchanged, hash-verified upstream
`src/dice/hfe/io/PlayerInput.hpp` from commit
`6b4d4e1f10dee9b1c8932db95f91b92e3eceb7db`.
It compiles real upstream set/get input functions into a standalone `.wasm` module.
There is a checked scalar C ABI and a TypeScript wrapper for six independent input
slots. Native tests, sanitizers, TypeScript compilation, and 14 Node/Wasm tests
passed in the preparation environment.

This is input routing only. No complete upstream engine build, world simulation,
game integration, server, browser gameplay test, downtown map, or online match has
been supplied. Preserve these distinctions in all progress reports.

The `engine/freestanding/` shims are ONLY for this audited header-only proof. Do not
extend them into a fake standard library. Use a supported pinned full C++ toolchain
for expanded modules; Emscripten is the preferred browser/Node Wasm route unless a
verified equivalent is already in the workspace.

## 2. Discover all real source roots before changing code

Read relevant AGENTS.md files, manifests, lockfiles, scripts, and current uncommitted
changes. Work on a nonproduction branch such as `feature/breadflower-engine-merge`.
Do not discard user changes, rewrite history, or deploy automatically.

Known product repository: `robjasper2084/Jungle-Lotto`.
Known base: `lottominded-ultra.io/games/gothtechnology2/`.

- Swoop source: `swoop-source/`.
- Swoop packaging: `scripts/build-swoop-detroit.mjs`.
- Explorer packaging: `scripts/build-elmwood-explorer.mjs`.
- Explorer source: resolve the current `ELMWOOD_SOURCE`, explicit argument, or
  configured `euc-detroit-riverwalk` project from the actual build script.
- Explorer entry: `elmwood.html`; preserve its actual launch and embed paths.
- Shared movement: inspect `@digital-static/ridecore` and the real linked
  `Digital_Static_RideCore` source, not just its license or built JS.
- Reference engine: obtain the real BreadFlowerDos source at the pinned commit
  in an auditable vendor/fork directory. Review newer commits separately rather
  than silently changing the baseline. Preserve upstream MIT notices.

The included vendor directory is a SUBSET; do not mistake it for a full checkout.
Keep a pristine upstream reference and a documented portable-integration fork, or
an equivalent patch series. Record file provenance and revisions for all projects.

Swoop's internal `?map=elmwood` is not the separately packaged Elmwood Explorer.
Both actual products must consume the integration and be tested independently.
A missing external source is an explicit blocker for that target, not permission
to patch minified bundles or substitute another map/game.

## 3. Merge architecture: real engine code without competing engines

Use this staged hybrid architecture:

```
Swoop UI/render adapter -----+
Elmwood UI/render adapter ---+-- shared engine bridge -- BreadFlowerDos portable C++
Downtown Royale adapter ----+        |                         + original extensions
                                    |
                             existing RideCore physics
                                    |
                   authoritative server host / room transport
```

Keep Three.js as the rendering owner and RideCore as the movement/collision owner
until a separate replacement has demonstrated parity. BreadFlowerDos code must
actually execute through the compiled bridge in gameplay; it is not just bundled
as unused source. This is an engine COMPONENT merge, not an assertion that two full
renderers can drive the same canvas or that upstream already has a working game.

For expanded C++ components, prefer one versioned Wasm artifact consumed by both
browser prediction/offline sessions and the Node authoritative service. Cache
compiled module code if helpful, but create isolated mutable instances/contexts
per match, prediction world, and replay. No cross-room globals or leaked input.
The supplied native proof is process-global; add a context API before considering
a multi-room native host.

Retain one simulation scheduler, one movement owner, one collision world per
simulation context, and one render loop. No parallel Rapier/BreadFlower physics
stepping the same rider. No second Three.js installation forced by a shared view
package. Pure data adapters are acceptable where renderer versions differ.

## 4. Audit the real engine, including incomplete code

The inspected upstream GameServer.cpp contains commented scaffolding. Important
EventManager post/process functions were TODOs. Do not call those working features
or make a server promise from their filenames.

Produce `docs/engine-merge/UPSTREAM_AUDIT.md` with each candidate subsystem marked:
`implemented and tested`, `partially implemented`, `interface only`, `incompatible`,
or `not needed`. Include the original file/function and evidence.

Use the real PlayerInput component first. Next evaluate the actual event-dispatch,
object-lifecycle, and game/map configuration facilities. Port usable source and
implement missing behavior in a clearly marked integration fork where necessary.
Retain upstream attribution. Never report newly authored behavior as something
already supplied by upstream.

Do not preserve reverse-engineered binary layouts as a public API. Audit pointer
width, alignments, union assumptions, global lifetime, std::string/STL ABI settings,
platform entry points, filesystem use, threads, sockets, and undefined behavior.
Do not silence static_assert failures or guess struct offsets to fake portability.
Where layouts must change, retain the original reference and document semantic
porting plus native/Wasm tests. Do not promise binary compatibility with BF2/2142.
Do not bundle proprietary game files or copyrighted game assets.

Use a deliberately selected source target. Do not automatically glob every upstream
.cpp into the browser just because the original CMake builds that way. Record
full-engine build attempts separately from selected-component build success.

## 5. Stable shared interface and genuine gameplay integration

Expose versioned scalar APIs or validated packed schemas with explicit lengths.
Never serialize C++ pointers, object layouts, vtables, or raw structs as the network
protocol. Use finite values, bounded arrays, explicit units and coordinate spaces,
stable entity identities, and defined error behavior.

Connect the included engine input path to actual gameplay in BOTH products:

1. Read physical controls through each game's existing action mapping.
2. Validate a complete frame before committing it; clear stale held actions.
3. Route validated actions through actual compiled BreadFlowerDos PlayerInput.
4. Read those engine channels into the real RideCore/mode adapter exactly once.
5. Verify steering is independent of aiming, and fire/hop/use retain their meanings.

The example channel map is an APPLICATION mapping. In upstream, channel 9 is
PIAction, not a ready-made EUC jump. Convert aim units explicitly. Keep brake/reverse
semantics from each controller. Do not send radians into a normalized [-1,+1] field.

Upstream PINone=64 is a sentinel, not a valid channel. Protect all reads/writes before
calling the shift/array logic. Validate JS numbers before Wasm integer coercion.
Do not expose arbitrary engine channels as public remote commands; authenticated
server action mapping is a separate security boundary.

Show instrumentation proving actual compiled functions are used. Then add at least
one meaningful engine-backed gameplay subsystem beyond input (event/lifecycle and
mode rules are the planned next candidates). Exercise it in an actual session;
unreferenced code or a disconnected lab test does not satisfy the merge.

## 6. Extend the merged core for STATIC ROYALE

Create a documented original `StaticRoyaleSession` extension in the portable C++
engine integration. Prefer engine facilities that have actually passed the audit.
If an event facility is incomplete, implement and test it in the integration fork
or explicitly record why a small new portable facility is used instead.

The server's engine-backed rules instance should own:

- Six-combatant roster and mode lifecycle.
- Weapon charges/ammo, cadence, shot identities, and switch timing.
- Shields, integrity, utilities, loot ownership, damage, eliminations, and outcome.
- Static Field phase/timers and boundary damage.
- Stable per-tick event ordering, deterministic seeds, and rule snapshots.

Retain server RideCore as movement/collision authority. Define the integration
pipeline before coding to prevent circular authority:

`validated inputs -> engine input -> RideCore fixed movement -> pose/query batch ->
engine weapon/rules step -> authoritative collision queries -> validated hit results
back to engine -> damage/outcome -> serialized authoritative snapshot`.

Adapt the phase order where the actual simulation needs substeps; document the final
order and test it. Only trusted server physics feeds collision results to the rules
core. A browser may never submit an accepted target, damage amount, or winner.

Use sweeps over the full projectile segment and respect first blocking geometry.
Resolve all same-step damage before deciding last-rider victory; define a draw when
all remaining riders are eliminated together. Any queue/ring-buffer overflow must
fail visibly or backpressure safely, not silently drop damage or duplicate awards.

Client prediction can reuse movement/input and cosmetic firing, but server-confirmed
state decides hits, loot, health, eliminations, and win. Share full movement snapshot
and restore including hidden motor/brake/hop/recovery state; the provided input-only
snapshot is NOT sufficient for rollback.

Do not claim determinism merely because both sides load Wasm. Test whole simulation
inputs, host math, seeds, step order, collision data, and initialization. Keep native
versus Wasm equivalence a separate tested claim.

## 7. Required game experience

Preserve the full playable rules in `03_STATIC_ROYALE_GAMEPLAY_SPEC.md`:

- Six riders fight while mounted on EUCs in a compact original downtown-inspired map.
- Human-only six-player rooms, opt-in mixed rooms totaling six, and offline 1+5 AI.
- Last rider standing; one life; spectators do not consume combatant slots.
- Working starter gear, shields, limited supplies, readable shrinking Static Field.
- Independent aiming/steering, charged hop, controlled braking/carving, short burst.
- Static Blaster, Heartbreaker hearts, and Bass Cannon with real distinct rules.
- LOVE TAG remains separate; no role infection in Royale and no Royale health rules
  leaking into normal Tag or exploration.
- No new combatants mid-round; reconnect restores the same existing participant.
- New downtown arena is canonical/shared, not a duplicated city and not pasted into
  Elmwood's cemetery. Both products can enter and return safely.

First prove the complete loop with a simple valid arena. Keep existing hero/EUC art
and add original assets later. No wholesale asset regeneration to avoid engine work.

## 8. Real six-player online service is mandatory

Inspect/reuse any current authoritative online service. If none is suitable, build a
Node/TypeScript host with compatible pinned Colyseus packages or another verified
room transport. The host calls the engine instance for rules; it does not duplicate
those rules independently in TypeScript. BreadFlowerDos's unfinished GameServer.cpp
is not a drop-in network service. Do not build two competing match authorities.

Implement create/join/invite/ready/load/match/results/rematch/leave/reconnect with real
clients. A room owner is not the authority process. Its departure must not destroy
the dedicated match host. Separate lobby metadata from engine roster ownership.

The authoritative host maps authenticated participants to the six slots. Bots take
slots but have no sockets; spectators have sockets but cannot issue combat inputs.
Validate session identity, sequence, command size/rate, action eligibility, finite
numbers, array limits, duplicate edges and queues. Never trust client physics dt,
health, ammo, hits, inventory, or zone phase. Do not advertise 'cheat-proof'.

Start from compatible fixed-step scheduling; evaluate 60-Hz room ticks with necessary
RideCore substeps and roughly 20-Hz published snapshots, then profile. Never feed
real-time frame jitter directly into C++ rule timers. Handle sustained overload with
an explicit bounded policy and telemetry rather than an endless catch-up spiral.

Handshake includes engine commit/module hash, bridge ABI, protocol, rules revision,
physics profile, map/arena revision, and collision artifact. Reject mismatches.
A production public binary hash is not a secret. Identity/administrative credentials
are server-only; invitations must not leak reconnect or session credentials.

Online bots run server-side and use the same actions/limits/collisions. Perception and
reaction time are bounded; no perfect hidden-player tracking. Offline practice uses
a local authority adapter with the same rule version, labeled offline.

Offline pause may stop the world. Online pause must only neutralize local controls
and open the UI while the room continues. During dropout, release input safely but
keep the rider vulnerable; restore state on reconnect and apply the configured
expiry outcome without resurrection or fresh ammunition.

GitHub Pages remains the static client host. A persistent WSS/HTTPS service must
host matches separately. Implement runnable server code, environment samples,
health checks, staging configuration, logs and documented TLS/origin validation.
Do not provision hosting or deploy without explicit authorization. Missing deployment
access blocks hosted verification, not local/server implementation.

## 9. Preserve both games and avoid integration regressions

Keep existing riders, EUCs, bicycles/community rides where present, companions,
free ride, races, LOVE TAG, landmarks, weather, lighting, sounds, touch customization,
XR/split-screen capabilities, saves and reward integrations. Do not force Royale
rules or hardcoded six slots onto modes with different existing capacity.

Use a feature gate and clean session ownership so exiting the engine-backed mode
restores normal controls, physics profile, cameras, mute choice and context. No new
store/about popup during battle. Respect neutral rearm on focus/menu/device changes.

Preserve Elmwood's movable/resizable/reassignable touch controls, portrait/landscape
settings and return routes. Keep existing camera-obstruction/readability/gesture
fixes; no new cinematic effect should hide combat or remove authoritative cover.
Downtown combat must not target civilian or companion entities from peaceful modes.

Art remains Blender-authored optimized GLB with original sockets/rigs/materials;
Higgsfield can supply approved concepts and motion references. Unity is an optional
preview tool, not an additional shipping renderer during this merge. No paid calls,
asset purchases or large installations without authorization.

## 10. Ordered milestones — all are required for CORE_RELEASE

M0. Audit/source/toolchain discovery; run supplied proof and preserve baseline builds.
M1. Wire compiled engine input into both real games behind a feature gate. Confirm
    live controller behavior and settings restoration; do not stop at a unit test.
M2. Port/complete audited engine components and original C++ Royale rules; test
    batched collision interface, snapshots, isolation, resource lifetime, and offline
    six-slot match from both product launch paths.
M3. Connect the real authoritative service; test six independent human clients,
    mixed rooms, state convergence, disconnect/reconnect, protocol mismatch and abuse.
M4. Polish the downtown arena/controls/assets; run separate packaged browser/device
    regression, performance, and authorized hosted-internet checks.

Budget limits do not turn a partial input bridge into a complete merge. Prefer
reusing existing art, source modules, and networking. Do not claim that 500 credits
cover all milestones. If the execution stops, leave exact next commands and status
rather than pretending it will continue in the background.

## 11. Required evidence and stop conditions

Use `02_ENGINE_MERGE_ACCEPTANCE_TESTS.md`. Maintain:

- `docs/engine-merge/STATUS.md`: implemented / tested / failed / blocked / not tested.
- `UPSTREAM_AUDIT.md`: actual reused source versus new behavior and unfinished upstream.
- `OWNERSHIP.md`: renderer/physics/rules/network/state ownership and tick pipeline.
- `PROVENANCE.md`: upstream commit, licenses, patches, artifacts and hashes.
- Test outputs, source revisions, per-game screenshots, and exact reproduction commands.

Preflight all sources/assets/licenses before cleaning outputs. Build to staging and
keep previous working packages. No production overwrite, automatic push/merge, paid
service activation or invented URLs.

Separate proof-level results, real game integration, six-client local-network tests,
and six-human hosted internet tests. If external Explorer/RideCore source is missing,
complete useful shared work and mark its integration BLOCKED. Do not silently replace
it or claim a build passed because the other game ran.

Full success means actual compiled BreadFlowerDos-derived code and documented new
engine extensions participate in both games' intended runtime path; six remote humans
can battle on wheels in the same downtown round; damage, zone, elimination and winner
are authoritative; and both original games remain usable afterward.

## Primary references

- Upstream: https://github.com/kiwidoggie/breadflowerdos
- Inspected commit: 6b4d4e1f10dee9b1c8932db95f91b92e3eceb7db
- Emscripten JS/C++ boundary: https://emscripten.org/docs/porting/connecting_cpp_and_javascript/Interacting-with-code.html
- Isolated module instances: https://emscripten.org/docs/compiling/Modularized-Output.html
- Portability: https://emscripten.org/docs/porting/guidelines/portability_guidelines.html
- Colyseus rooms/state: https://docs.colyseus.io/room and https://docs.colyseus.io/state

Confirm APIs against the toolchain/package versions actually used. The listed docs
are references, not proof that any component is already installed or integrated.
