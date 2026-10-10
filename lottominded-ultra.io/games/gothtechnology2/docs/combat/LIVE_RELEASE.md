# Mounted combat and Mack-to-Chene release candidate

User authorized publishing on October 9, 2026. This package is a playable release candidate; complete engine acceptance is still pending.

## Included
- Both real game entries and return paths to one original Detroit arena.
- The initial blue field covers Mack Avenue, the whole Dequindre Cut and Chene Park, for all five seeded centers. Initial radius 1,525 m; staged radii 1,525 / 1,220 / 762.5 / 250 / 16 / 0 m. C++ owns the authoritative radius, phase and damage; semantic snapshots retain the selected profile.
- Actual pinned BreadFlowerDos PlayerInput plus explicitly original compiled rules extensions. RideCore owns wheel movement and authored scenery collision; Three.js renders the existing games. This is not a replacement Unity renderer or a completed upstream engine merge.
- Selected wheel handling, projectile travel/drop, magazine/reload/fire modes, independent aim, and fitted two-hand equipment.
- Five actual rider rigs, three weapons, three aim blends, three yaw limits, three carve angles and three aim pitches: 1,215 numeric contact scenarios; under 2 cm hand error, zero pedal-pose drift in those scenarios. Finger/eye alignment, all reload/crash transitions and physical-device acceptance remain incomplete.

## Verified locally
- 30 engine/RideCore combat and regression tests.
- Five authored-map opening-circle seeds, all required landmarks inside, six reachable spawn bays, 12 clear supply sites, snapshot restore.
- Six independent automated socket clients: room capacity, incompatible version refusal, movement, reconnect, spectator separation and all supported AI fills. These are not six humans.
- Actual Swoop source and separate euc-detroit-riverwalk Elmwood builds, with portable package validation.

## Remaining acceptance
Six-human test remains pending by the user's explicit choice. Physical iPad/Android, XR, split-screen combat, sustained WAN latency/loss, all character animation transitions and broad performance acceptance are not claimed. Online private rooms require a running compatible authority; the optional Supabase relay is a temporary test service requiring this computer and its access code. Publishing Pages does not deploy a permanent game server.

Engine module: 2ac9a1d3a5fb5745e8b37e4411f2e17caadf82944ea0ec7b18ab00b075377136; ABI 4; rules static-royale-cpp-2; snapshot 6; arena mack-chene-1. Older engine-merge reports describe earlier revisions and are retained as historical evidence. The current contact and boundary JSON reports are under docs/combat/evidence.
