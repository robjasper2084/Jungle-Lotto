# CORE_RELEASE ownership

Local integration branch: upgrade-redesign. No production packaging or deployment is authorized.

Three.js owns rendering. Existing Digital Static RideCore owns controller state, movement, terrain queries and collision. Existing game loops remain the sole schedulers. Neither Blender nor Unity becomes a second shipping renderer.

The pristine BreadFlowerDos source is pinned in engine/breadflowerdos/upstream. The supplied-kit folder is immutable proof input. integration/ is a separate portable integration: unchanged upstream PlayerInput plus explicitly original context lifetime, bounded event handling and StaticRoyaleSession rules.

Each simulation owns a new Wasm instance/context. Cached compiled modules have no mutable state. Native context handles include generations; invalid/destroyed handles fail. Normal modes use an opt-in engine=breadflower test switch; gate-off behavior keeps its original input path and capacities.

Authoritative tick order: authenticated bounded commands -> compiled PlayerInput -> two RideCore movement substeps -> trusted poses -> C++ weapon/loot/field requests -> full projectile segment queries against the server collision world -> validated hit results -> C++ simultaneous damage/elimination/outcome -> public snapshot. No client-supplied hit, health, inventory, dt or result is accepted.

TypeScript retains sockets, identity/name/skin metadata, input queues, AI perception/navigation, physics, visibility filtering and display. Engine-enabled rules must not also execute the legacy TypeScript rule step. Legacy rules remain available only behind the disabled feature gate until acceptance is complete.

Rule snapshots are explicit versioned scalar schemas, never C++ object memory. Host replay snapshots must additionally retain controllers, AI navigation, command queues and identity mappings. The input-only starter snapshot is not full rollback.

Human play and physical-device evidence cannot be replaced with automated clients or simulated viewport sizes.

Server overload policy: 60-Hz steps, at most 15 catch-up steps / 250 ms per callback; dropped wall time, overload callback count and maximum step duration are measured in hostPerformance snapshots and ROYALE_FRAME_BUDGET logs. Timers advance only with executed ticks. Fatal C++ queue/lifetime errors stop the room with a visible notice and close code 1011. No outcome is fabricated after an engine failure.

Collision results can resolve a projectile index/serial at most once per engine tick. Whole-match restores validate a candidate context and host state before replacing a live context. Reconnecting clients adopt retained input and shot sequence floors; a page refresh cannot reset ammunition or suppress firing until an old sequence is replayed.

The active shared arena now loads the original Swoop Detroit scenery with the exported Detroit collision snapshot. DowntownArena selects connected Atwater starts and five final-field sites; both entry origins use that same map identity. C++ receives and snapshots those center coordinates. SceneryWorld lets the existing visual builders read canonical ground without registering duplicate physics bodies. Normal scenery construction still supplies DetroitWorld and retains its registration behavior. The old compact ArenaTerrain remains an explicit unit-test fixture, not the player-facing scene. Elmwood returns to its separate cemetery package.
