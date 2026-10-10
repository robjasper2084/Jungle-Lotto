# BreadFlowerDos upstream audit

Pinned commit: 6b4d4e1f10dee9b1c8932db95f91b92e3eceb7db. Full 161-file source vendored; per-file blobs and SHA-256 recorded in engine/breadflowerdos/UPSTREAM_SOURCE.json.

| Candidate | Status | Evidence / integration decision |
| --- | --- | --- |
| io/PlayerInput.hpp setInput/getInput | Implemented and tested | Exact upstream header passes supplied native ASAN and all 14 supplied Wasm tests. Reject sentinel 64, invalid slots, nonfinite/out-of-range values before upstream shifts/arrays. |
| EventManager.cpp postEvent/processEvents/removeEvent | Partially implemented | Core functions are TODO; priority handler insertion exists. Raw void pointers, process globals and missing destructor cleanup prevent reuse as working dispatch. New bounded typed rules events are original integration behavior. |
| EventManager layout | Incompatible | Full Emscripten compile fails actual 288 vs asserted 776 bytes. Assertion retained in pristine reference; no binary-layout compatibility claim. |
| world/Object.hpp | Interface only | Abstract object lifecycle and legacy layout. New slot/context lifetime is separately authored; no claim to an upstream working entity world. |
| world/PlayerManager.cpp | Partially implemented | Add/map paths exist, removal and several lookup paths unfinished. Not a safe multiplayer roster. |
| VariableStorage.hpp | Partially implemented | Map operations work in probe; lastLookup stores address of a local iterator. Not used in shipping integration. |
| SettingsRepostitory | Partially implemented / incompatible | Forwarders plus old STL layout assertions. No need for binary-layout port. |
| Game.hpp MapInfo | Partially implemented | Metadata getters work; load/loadPath return false. Existing real maps and collision remain host-owned. |
| ServerSettings | Interface/data only | No complete initialization/validation lifecycle. |
| GameServer.cpp | Interface only | Commented scaffolding, not a network server. Existing Colyseus host is retained. |
| TickCalculator | Partially implemented | Constructor reciprocal only; compute lacks implementation. Keep existing fixed scheduling. |
| Full upstream CMake source glob | Not tested / not selected | Browser selected-component success does not mean full upstream engine success. |

No proprietary BF2/2142 assets are copied. Existing licensed game assets are preserved.
