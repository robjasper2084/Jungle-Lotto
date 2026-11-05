# Acceptance matrix — engine merge, not just an input demo

Prepared October 9, 2026. PASS means actual evidence; PLAN is not PASS.

## A. Included isolated proof

| ID | Check | Package status / evidence |
|---|---|---|
| P01 | Upstream header and license match pinned Git blob hashes | PASS — evidence/provenance-check.txt |
| P02 | Native C++ calls upstream input functions across 6x64 channels | PASS — evidence/native-tests.txt |
| P03 | Native address/undefined-behavior sanitizers run | PASS for exercised tests — evidence/native-sanitizers.txt |
| P04 | Wasm compilation uses actual unmodified header | PASS — evidence/wasm-build.txt, source + binary |
| P05 | 14 Wasm tests execute, including slot/instance isolation | PASS — evidence/wasm-tests.txt |
| P06 | TypeScript adapter compiles | PASS — preparation run; evidence/typescript-version.txt |
| P07 | Complete upstream engine builds | NOT TESTED; only selected header component compiled |
| P08 | Browser/device gameplay using this bridge | NOT TESTED |
| P09 | Network server or six connected players | NOT IMPLEMENTED in starter |

The 14 Wasm tests use Node's WebAssembly runtime, not network clients. The native
CTest entry contains many assertions but is reported as one native test program.
Neither result is a performance guarantee or proof of complete memory safety.

## B. Source and real integration — all currently NOT TESTED

| ID | Required check | Evidence to collect |
|---|---|---|
| I01 | Both actual source roots and RideCore resolved | Absolute paths/revisions; target-specific blockers |
| I02 | Actual upstream source fork pinned; every copied/changed file attributed | Provenance report and license audit |
| I03 | Full-source and selected-target builds distinguished | Exact commands and separate outcomes |
| I04 | Swoop controller consumes compiled engine inputs, not a disconnected test | Runtime trace + independent gameplay pass |
| I05 | Separate Elmwood Explorer consumes compiled input path | Same evidence against real elmwood.html package |
| I06 | Aim/fire do not overwrite steering/throttle | Desktop/touch/controller scenarios |
| I07 | At least one real engine-backed lifecycle/rules subsystem beyond input | Test, instrumentation, gameplay call path |
| I08 | Native/Wasm ABI assumptions checked rather than assertions suppressed | Compiler logs + portability patches |
| I09 | Existing games still run with feature gate off | Baseline regression and saves/settings comparison |
| I10 | Exit/reenter mode clears held actions and restores preferences | Both games; pointer/focus/device cases |
| I11 | Wasm load failure, blocked script, wrong hash fail clearly | Error UI and preserved normal play |
| I12 | Modes with other capacities remain unchanged | LOVE TAG/community/free-ride regression |

## C. Engine/physics/network authority — all currently NOT IMPLEMENTED

| ID | Required check | Passing outcome |
|---|---|---|
| A01 | One scheduler and movement/collision owner | No double stepping or duplicate authoritative bodies |
| A02 | Per-match/per-prediction mutable state isolation | Simultaneous rooms cannot observe/change each other |
| A03 | Rules snapshots include all state | Identical replay after restore with same inputs |
| A04 | Controller snapshots include hidden movement state | Correct reconciliation, not pose-only resets |
| A05 | Invalid commands are rejected before coercion or native calls | No crash, memory error, bypass, or partial frame mutation |
| A06 | Projectile sweep obeys first wall/rider impact | No tunneling or camera-origin shots through walls |
| A07 | Same-step damage resolves before outcome | Exactly one winner or explicit draw |
| A08 | Zone phases and damage are server-owned | Clients cannot extend time or evade damage with modified clocks |
| A09 | Event overflow and entity lifecycle are bounded | No silent dropped damage, duplicate award, stale identity reuse |
| A10 | Wasm/engine/protocol/map/physics hashes validated | Incompatible clients cannot join a conflicting simulation |

## D. Six-player online Royale — all currently NOT IMPLEMENTED

| ID | Required check | Passing outcome |
|---|---|---|
| N01 | Six independent human clients join and play | Separate participants, inputs and synchronized authoritative results |
| N02 | Seventh active combatant refused | Spectators and bots accounted separately from connections |
| N03 | 1 human + 5 bots and other allowed mixes | Exactly six active slots; bots labeled and server-controlled |
| N04 | Create/code/invite/ready/start/rematch | Entire round loop without manual dev-console state edits |
| N05 | Reconnect during damage and late in round | Same health/gear/alive state; no resurrect/free-ammo exploit |
| N06 | Online pause and lobby-owner departure | Match continues under dedicated authority |
| N07 | Out-of-order/duplicate/burst command traffic | Bounded queues/rates; no extra shots or movement |
| N08 | Latency/disconnect/load testing | Recorded network conditions, correction rates and server frame budget |
| N09 | Hosted service reached from different external networks | Actual WSS/TLS evidence; not localhost-only proof |
| N10 | Auth/slot ownership enforcement | No participant can write another's engine input slot |

## E. Both product paths and environment — all currently NOT IMPLEMENTED

| ID | Required check | Passing outcome |
|---|---|---|
| G01 | New original downtown arena is reachable from both games | One canonical arena, correct join/map hash and return route |
| G02 | All six remain mounted and can aim/fire while maneuvering | Real combat loop, not standing avatars or cosmetic wheels |
| G03 | Fixed hit volumes and battle handling | Cosmetic choice cannot alter advantage; normal riding stays unchanged |
| G04 | Safe zones validated against traversable topology | No unreachable rooftop/building-only final circle |
| G05 | Mobile controls and camera clarity | Independent touch ownership; no long-press popup or blocked view |
| G06 | Original Elmwood scenery and content preserved | No forced downtown rebuild inside cemetery; landmarks/saves intact |
| G07 | LOVE TAG stays separate | No tag-role transitions in Royale and no Royale damage in normal Tag |
| G08 | Build preflight/rollback | Missing dependencies do not erase last working packages |
| G09 | Browser and target-device testing per product | Screenshots, versions, errors, FPS/frame-time measurements, not claims from video alone |
| G10 | No live deployment without authorization | Staging packages + documented rollback and pending hosted gates |

## Final report format

For every gate include: ID, target, status, source revision, command/action, result,
evidence path, blocker if any, and next runnable step. Clearly separate provided
starter results from results achieved after integrating into the actual games.
