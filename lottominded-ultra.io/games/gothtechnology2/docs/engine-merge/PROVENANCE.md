# Source and artifact provenance

Source discovery: evidence/source-preflight.json and evidence/game-source-hashes.json. Both real source projects and Digital_Static_RideCore were read, including their manifests and packaging scripts.

Swoop: lottominded-ultra.io/games/gothtechnology2/swoop-source.
Separate packaged Elmwood: lottominded-ultra.io/games/gothtechnology2/elmwood-source (current build helper default).
Original external Explorer: C:/Users/digit/Documents/phone/euc-detroit-riverwalk.
Linked original RideCore: C:/Users/digit/Documents/phone/Digital_Static_RideCore.
Local Royale extension: sibling ride-core; its server link and explicit browser imports resolve here.

Upstream https://github.com/kiwidoggie/breadflowerdos at 6b4d4e1f10dee9b1c8932db95f91b92e3eceb7db, MIT. Full immutable reference in engine/breadflowerdos/upstream; manifest records all files. Supplied ZIP extracted independently under supplied-kit with its own PROVENANCE.json and MIT notices.

PlayerInput.hpp blob: 9f7195e8424c3d95c6fef3c8ce48c6410a8feb68.
Supplied proof Wasm SHA-256: 9bb041097f8b17ad3bef6a5ec4e97cdfe769eadde77cae67cd33afbb0aeb5902.

integration/ contains original portable extensions, not upstream functionality claims. It compiles the unchanged vendored PlayerInput header with the full Unity 6000.3.24f1 Emscripten 3.1.39-git toolchain. No freestanding standard-library substitutes are used for expanded modules.

Local native compiler: MSVC 14.50.35717 / Windows SDK 10.0.22621.0, AddressSanitizer. Provided native program compiled directly; CMake/CTest and native UBSan have not run locally. Preparation-environment evidence remains separate.

Blender 5.2.1 actually imported and checked six existing GLBs; see evidence/blender-assets.json. Unity 6000.3.24f1 imported copies of all five riders and the EUC, checked meshes/rigs/bounds and saved Assets/EngineReview/EngineAssetPreview.unity in the existing animation-polish Unity project. See evidence/unity-assets.json and unity-assets.log. These headless checks do not establish animation quality or physical-device performance.

Current integration module SHA-256: 0e029a5e3241d634280e1e1e696c270efebbd5e182e2e50ba2176cbbc1fcc137. ABI 3; original rules static-royale-cpp-1; semantic rule snapshot version 4. This is distinct from the supplied proof binary. Historical blockout evidence uses older modules. Current authored-map browser and network evidence uses this module.
