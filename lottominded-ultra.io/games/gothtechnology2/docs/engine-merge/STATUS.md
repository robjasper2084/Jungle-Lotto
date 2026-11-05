# CORE_RELEASE — local integration in progress

Updated October 9, 2026 (UTC evidence October 10). **Not release accepted. Not deployed.** N01 six-human testing is **pending by explicit user request**: "Leave six-human test pending." Automated clients do not satisfy it.

The complete kit is present under engine/breadflowerdos/supplied-kit. README.md, 00_START_HERE.txt, the master prompt, specification and acceptance matrix were read. The missing-kit blocker is resolved; separate prompt/report files are not treated as the kit.

## Implemented and exercised locally

- Unchanged actual BreadFlowerDos PlayerInput from pinned upstream 6b4d4e1f10dee9b1c8932db95f91b92e3eceb7db executes in both real Swoop and separate Elmwood controller paths behind engine=breadflower.
- Clearly attributed original C++ extensions own roster/lifecycle, weapons/ammo, shields/repairs/loot, field, authoritative damage, eliminations and outcomes. RideCore remains movement/collision owner and Three.js remains renderer.
- One versioned Wasm artifact runs in isolated browser/prediction/server contexts. Whole rules/controller/AI/queue snapshots, transactional restore, generation handles, bounded events and strict commands/handshakes are implemented.
- Real Colyseus authority on loopback 8212 supports six combatants, spectators, explicit AI fill, ready/start/results/rematch and reconnect. Refresh-style reconnect adopts retained sequence floors and does not reset ammunition.
- Both actual products enter/return from one shared arena using original Swoop Detroit scenery, textures, HDR lighting, and canonical authored collision. The match field/spawns occupy a connected Atwater district. Separate Elmwood cemetery exploration is retained; LOVE TAG remains separate. No replacement box city is rendered.
- Bot navigation was fixed after a full-round log exposed circling and field-only deaths: steering now matches RideCore's heading convention and route following skips collision-clear intermediate nodes. Tests now require bot shots and authoritative hits.
- Blender 5.2.1 imported six existing rider/EUC GLBs. Unity 6000.3.24f1 imported copies, checked rigs/bounds and saved EngineAssetPreview.unity. These actual tool runs do not mean Unity renders the browser games.

## Verified results

The subsequent [asset and animation pass](ASSET_ANIMATION_AUDIT.md) adds six actual Higgsfield/Blender equipment models with material skins and six authored clips, checked in Unity and integrated into the shared arena. This does not change the incomplete engine/human/device acceptance status below.

| Layer | Current evidence |
| --- | --- |
| Supplied proof | Pinned source/license PASS; 14 Wasm tests PASS; strict TypeScript 5.9.3 PASS; native MSVC AddressSanitizer PASS |
| Expanded rules | 9 engine/RideCore tests PASS, including whole replay, all five field phases and final deadline draw; native ASAN and Wasm UBSan PASS |
| Fallback and scheduler | 14 legacy Royale tests PASS; 2 bounded server-clock tests PASS |
| Six-client network | Six independent automated SDK clients, movement, seventh refusal, mismatch rejection, late spectator, reconnect, owner departure and all allowed AI mixes PASS on localhost |
| Complete socket round | Latest authored-map run 141.18 seconds: one automated client plus five AI, bot shots/hits, fresh-client reconnect with immediate firing, results and clean rematch PASS |
| Actual product browsers | Compiled-input riding in both real games; independent entry/return; gate-off riding; corrupt-Wasm alert with normal riding available |
| Authored map | Six clear starts, five reachable centers, 12 supplies, canonical hash agreement, all five C++ center configurations and snapshot restore PASS |
| Packaging | Separate isolated Swoop and Elmwood stage builds PASS |

Latest round telemetry: zero dropped simulation time / overload callbacks, maximum server step 25.547 ms. One localhost round is not WAN/load/p95/p99 or mobile-performance evidence. Brief desktop browser samples near 60 fps are not guarantees. Large chunks still produce Vite warnings.

Current engine SHA-256: 0e029a5e3241d634280e1e1e696c270efebbd5e182e2e50ba2176cbbc1fcc137; ABI 3; original rules static-royale-cpp-1; semantic snapshot version 4. Configured field centers are validated and serialized in C++. Earlier blockout browser/module evidence remains historical. Current authored-map evidence is in swoop-authored-arena.json, elmwood-authored-arena.json, downtown-map.json and the current network reports. Source hashes are in acceptance-source-manifest.json, beyond shared Git HEAD 1b6796a8b61b6e2be96ac316ecc90d8a43ea0454.

## Incomplete acceptance and blockers

- N01 six-human play intentionally pending. N09 exact-revision HTTPS/WSS across external networks untested; older Supabase or LOVE TAG hosting results are not this engine integration.
- Physical iPad/Android, simultaneous multi-touch/gamepad, focus/rearm, and full saves/settings preservation need device sessions. A resized desktop browser is insufficient.
- Packet delay/loss/reordering and sustained multi-room load need correction distributions and p95/p99 timings.
- Original-map correction is integrated and browser-verified from each product. Detailed traversal of every original landmark and consistent physical mobile-device performance remain unverified.
- Every rider animation/socket, cross-cosmetic cover/hit-volume fairness, complete original-map walkthroughs and all existing-mode regressions are not accepted yet.
- Full upstream engine build and local native UBSan/CTest are not tested. The selected EventManager Wasm probe fails its unchanged layout assertion (288 versus 776); TODO/incompatible upstream facilities are documented in UPSTREAM_AUDIT.md.

Milestones: M0 source/proof/selected-toolchain recorded with upstream limits; M1 real controller integration works locally with preservation/device gates incomplete; M2 local compiled rules and offline sessions tested; M3 local automated authority tested but human/hosted gates pending; M4 partial. **This is not a completed engine merge or released multiplayer game.**

## Local handoff

Swoop: http://127.0.0.1:4191/arcade/swoop-detroit/?engine=breadflower

Separate Elmwood: http://127.0.0.1:4191/arcade/elmwood-explorer/elmwood.html?engine=breadflower

Use each game's Royale entry. For local online tests uncheck the old Supabase-test option and use http://127.0.0.1:8212. Removing engine=breadflower restores the original path. Isolated outputs are under .game-builds/engine-merge-20261009. Preview and authority need this computer/processes running; the temporary corrupt-module server 4192 is not a delivered service.

ACCEPTANCE.md / ACCEPTANCE.json track all 51 kit IDs in 93 records separating shared proof and each actual game. REPRODUCE.md contains exact commands and continuation steps. This task did not commit, merge, push, promote live packages, deploy or activate paid services. Other chats have concurrent changes in this dirty checkout; preserve them.

