# Engine merge acceptance ledger

Status: **CORE_RELEASE in progress; not a completed engine merge or release.** Six-human testing remains pending by explicit user request.

Current original-map module: 0e029a5e3241d634280e1e1e696c270efebbd5e182e2e50ba2176cbbc1fcc137. Earlier blockout evidence is historical. Commands, file evidence and source revisions are in ACCEPTANCE.json; each game is tracked separately. Local automated clients are not six-human or physical-device acceptance.

## Shared supplied proof / selected integration

| ID | Status | Recorded result | Remaining step |
| --- | --- | --- | --- |
| P01 | PASS | Pinned input header and MIT license verified against upstream Git blobs. | See evidence in JSON. |
| P02 | PASS | Supplied C++ native program exercised all 6 x 64 input channels. | See evidence in JSON. |
| P03 | PARTIAL | Local supplied and expanded native AddressSanitizer passed; expanded Wasm UBSan passed. Preparation-environment native UBSan results are not local results. | Run supported native Clang UBSan and CTest when that toolchain is available; keep Wasm and native outcomes separate. |
| P04 | PASS | Unity-installed full Emscripten compiled the unchanged actual upstream input header; selected target only. | See evidence in JSON. |
| P05 | PASS | 14 supplied Wasm tests passed in this local environment. | See evidence in JSON. |
| P06 | PASS | Supplied TypeScript adapter passes strict compilation with TypeScript 5.9.3; no files emitted into pristine kit. | See evidence in JSON. |
| P07 | NOT TESTED | Complete upstream engine is not built or advertised as working. Selected input component and original extensions are built. | Keep upstream immutable; evaluate full build separately. Do not suppress failing layout assertions. |
| P08 | PARTIAL | Post-integration desktop browser gameplay observed separately for both real games. The starter itself supplied no gameplay. Physical devices untested. | Follow G09 per product. |
| P09 | PASS — LOCAL AUTOMATED | Expanded integration has six independent localhost SDK clients; the original starter has no network service. | N01 remains pending at the user's explicit request. |

## Swoop Detroit

| ID | Status | Recorded result | Remaining step |
| --- | --- | --- | --- |
| I01 | PASS | Both actual source projects and linked original RideCore resolved; Elmwood is its own elmwood.html package. | See evidence in JSON. |
| I02 | PASS | Complete pinned upstream reference, immutable supplied kit, MIT notice and clearly attributed original integration are recorded. | See evidence in JSON. |
| I03 | PASS | Selected component success and full-engine non-build are explicitly distinguished. | See evidence in JSON. |
| I04 | PASS | Swoop's real controller routes existing physical controls through compiled PlayerInput and advances the original ride simulation. | See evidence in JSON. |
| I05 | N/A — OTHER PRODUCT | See Elmwood I05; Swoop's actual controller is I04. | See evidence in JSON. |
| I06 | PARTIAL | Compiled aim and steering channels are isolated by tests; browser keyboard movement and fire pass. | Run independent finger ownership, aim, fire and steering on actual touch and gamepad devices. |
| I07 | PASS | C++ rules beyond input own ammunition, damage, shield, loot, field, elimination and results in real practice and server sessions. | See evidence in JSON. |
| I08 | PASS | ABI is versioned and validated. The original EventManager assertion fails visibly (288 versus 776); it was not suppressed or represented as usable. | See evidence in JSON. |
| I09 | PARTIAL | Both normal games run and accept movement with the engine gate off; no forced six-slot rules in exploration. | Compare existing profiles, audio, camera, input and saved progress with gate both off and on. |
| I10 | PARTIAL | Both return links preserve the originating product and optional engine gate; source clears held inputs on leave/focus/menu. | Run the focus/device/rearm matrix and compare saved preferences. |
| I11 | PARTIAL | Injected corrupt Wasm produces a visible hash-error alert while normal riding remains usable in both games. | Extend fault server to explicit 404/blocked-script cases and verify no silent engine-mode fallback. |
| I12 | PARTIAL | Feature gate is outside normal mode capacities; legacy Royale suite passes. Other chat's Tag checks are not counted as this engine acceptance. | Run existing mode regressions independently for each product. |
| A01 | PASS | Existing loops own scheduling; RideCore moves each controller in two substeps; only one engine or legacy rule step runs. | See evidence in JSON. |
| A02 | PASS | Independent Wasm instances, generation handles, slot/context isolation and disposal are exercised. | See evidence in JSON. |
| A03 | PASS | Whole rules plus host queues, AI and movement snapshot replay is identical; failed restore leaves the live context intact. | See evidence in JSON. |
| A04 | PASS | Replay/reconciliation captures hidden movement/motor/brake state, not just displayed pose. | See evidence in JSON. |
| A05 | PASS | Finite values, channel/slot bounds, sequence and complete frame validation reject malformed or extra authoritative fields before execution. | See evidence in JSON. |
| A06 | PASS | Full projectile segments use trusted server collision sweeps; real cover blocks shots and stale projectile results are rejected. | See evidence in JSON. |
| A07 | PASS | Same-tick damage is applied before outcome, including explicit simultaneous draw; results freeze. | See evidence in JSON. |
| A08 | PASS | Compiled field visits all five phases, radius only shrinks, final-center deadline forces draw; socket round records server field damage and results. | See evidence in JSON. |
| A09 | PASS | Bounded contexts/events/hits, generation handles and duplicate projectile rejection are tested; fatal rule errors stop the room visibly. | See evidence in JSON. |
| A10 | PASS | Handshake validates exact engine commit/module/ABI/protocol/rules/map/collision/physics identity and rejects mismatch. | See evidence in JSON. |
| N01 | PENDING — USER DEFERRED | User explicitly said: Leave six-human test pending. Automated clients are not human participants. | When user resumes this acceptance gate, run six humans on separate external networks with this exact artifact. |
| N02 | PASS — LOCAL AUTOMATED | Seventh active combatant rejected; late arrivals are spectator-only; bot slots counted independently. | See evidence in JSON. |
| N03 | PASS — LOCAL AUTOMATED | All socket+AI mixes totaling six validated, from 1+5 through 6+0. Socket drivers were automated. | See evidence in JSON. |
| N04 | PARTIAL | Public session API exercises create/code/ready/start/results/rematch; UI offline practice verified from both origins. | Create and join via copied invitation using separate browsers, then repeat rematch/leave. |
| N05 | PARTIAL | New client object reconnects with same identity, retained ammo and sequence floors; immediate firing accepted. Unit test prevents resurrection after expiry. | Run reconnect during combat/field damage and close to elimination under delay/loss. |
| N06 | PARTIAL | Local SDK owner-departure test confirms dedicated match survives. Online pause sends neutral input in source; offline menu pauses world. | Pause one online UI client while another observes continued field and vulnerability. |
| N07 | PARTIAL | Duplicate/old/nonfinite/oversized action fields and bounded queue limits covered; server rate caps exist. | Add delayed/reordered/duplicate socket traffic and assert bounded work and unchanged shot cadence. |
| N08 | PARTIAL | Local full-round records bounded 60-Hz scheduler and hostPerformance; this is not a WAN or load profile. | Run explicit latency/loss profiles and multi-room load; record correction and frame-time distributions. |
| N09 | NOT TESTED | New compiled integration has loopback server evidence only; older Supabase/Tag hosting is not evidence for this revision. | Use the previously authorized private test relay with matching hashes; obtain any newly needed access. Do not overwrite live games. |
| N10 | PASS — LOCAL AUTOMATED | Server maps connection identity to its actor; clients cannot submit another slot, damage, health, hits or outcomes. | See evidence in JSON. |
| G01 | PASS — LOCAL MAP INTEGRATION | Original Swoop scenery and canonical Detroit collision are connected to active compiled Royale; both games enter the same Atwater district and return to their own original maps. | See evidence in JSON. |
| G02 | PARTIAL | Mounted movement and aiming/fire use real rider/EUC assets; five rider rigs and wheel import in Blender and Unity. | Visually exercise each rider with maneuvering/aim/fire and verify sockets and mounted posture. |
| G03 | PARTIAL | Fixed battle handling and fixed hit volumes in source; normal riding retains its own profile. | Compare each skin's effective cover, weapon origin and hit eligibility; correct any geometry advantage. |
| G04 | PASS — AUTHORED DISTRICT | Six starts, 12 supplies and five field centers are clear on canonical Detroit physics; routes connect every start to each center. C++ centers match the actual map and survive snapshot restore. | See evidence in JSON. |
| G05 | PARTIAL | Touch layout, separate pointer owners and gamepad mappings implemented; narrow desktop viewport review is not device validation. | Test physical iPad/Android and gamepad with simultaneous move/aim/fire and rearm. |
| G06 | PARTIAL | Actual Elmwood cemetery gameplay and separate package retained; arena is a different route. | Compare saved settings/progress and finish an original-map regression walkthrough. |
| G07 | PASS — ARCHITECTURE | Royale rule/session path is separate from LOVE TAG and normal exploration; no civilian/companion target roster. | Keep Tag testing and Royale health/damage evidence separate. |
| G08 | PASS | Both package inputs preflight before isolated build output writes; staged packages and gate-off rollback documented. | See evidence in JSON. |
| G09 | PARTIAL | Separate actual product browser input, gate-off and error evidence recorded. Desktop samples around 60 fps are brief observations, not hardware guarantees. | Profile both original maps and Royale on target hardware with sustained p95/p99 frame times, load times and graphics fallback. |
| G10 | PASS | This task created isolated staging only and did not commit, merge, push, promote production packages, deploy or activate paid services. | Keep live deployment gated on explicit authorization. |

## Elmwood Explorer

| ID | Status | Recorded result | Remaining step |
| --- | --- | --- | --- |
| I01 | PASS | Both actual source projects and linked original RideCore resolved; Elmwood is its own elmwood.html package. | See evidence in JSON. |
| I02 | PASS | Complete pinned upstream reference, immutable supplied kit, MIT notice and clearly attributed original integration are recorded. | See evidence in JSON. |
| I03 | PASS | Selected component success and full-engine non-build are explicitly distinguished. | See evidence in JSON. |
| I04 | N/A — OTHER PRODUCT | See Swoop I04; Elmwood's actual controller is I05. | See evidence in JSON. |
| I05 | PASS | The separately packaged Elmwood entry routes its real ride-motion input through compiled PlayerInput. | See evidence in JSON. |
| I06 | PARTIAL | Compiled aim and steering channels are isolated by tests; browser keyboard movement and fire pass. | Run independent finger ownership, aim, fire and steering on actual touch and gamepad devices. |
| I07 | PASS | C++ rules beyond input own ammunition, damage, shield, loot, field, elimination and results in real practice and server sessions. | See evidence in JSON. |
| I08 | PASS | ABI is versioned and validated. The original EventManager assertion fails visibly (288 versus 776); it was not suppressed or represented as usable. | See evidence in JSON. |
| I09 | PARTIAL | Both normal games run and accept movement with the engine gate off; no forced six-slot rules in exploration. | Compare existing profiles, audio, camera, input and saved progress with gate both off and on. |
| I10 | PARTIAL | Both return links preserve the originating product and optional engine gate; source clears held inputs on leave/focus/menu. | Run the focus/device/rearm matrix and compare saved preferences. |
| I11 | PARTIAL | Injected corrupt Wasm produces a visible hash-error alert while normal riding remains usable in both games. | Extend fault server to explicit 404/blocked-script cases and verify no silent engine-mode fallback. |
| I12 | PARTIAL | Feature gate is outside normal mode capacities; legacy Royale suite passes. Other chat's Tag checks are not counted as this engine acceptance. | Run existing mode regressions independently for each product. |
| A01 | PASS | Existing loops own scheduling; RideCore moves each controller in two substeps; only one engine or legacy rule step runs. | See evidence in JSON. |
| A02 | PASS | Independent Wasm instances, generation handles, slot/context isolation and disposal are exercised. | See evidence in JSON. |
| A03 | PASS | Whole rules plus host queues, AI and movement snapshot replay is identical; failed restore leaves the live context intact. | See evidence in JSON. |
| A04 | PASS | Replay/reconciliation captures hidden movement/motor/brake state, not just displayed pose. | See evidence in JSON. |
| A05 | PASS | Finite values, channel/slot bounds, sequence and complete frame validation reject malformed or extra authoritative fields before execution. | See evidence in JSON. |
| A06 | PASS | Full projectile segments use trusted server collision sweeps; real cover blocks shots and stale projectile results are rejected. | See evidence in JSON. |
| A07 | PASS | Same-tick damage is applied before outcome, including explicit simultaneous draw; results freeze. | See evidence in JSON. |
| A08 | PASS | Compiled field visits all five phases, radius only shrinks, final-center deadline forces draw; socket round records server field damage and results. | See evidence in JSON. |
| A09 | PASS | Bounded contexts/events/hits, generation handles and duplicate projectile rejection are tested; fatal rule errors stop the room visibly. | See evidence in JSON. |
| A10 | PASS | Handshake validates exact engine commit/module/ABI/protocol/rules/map/collision/physics identity and rejects mismatch. | See evidence in JSON. |
| N01 | PENDING — USER DEFERRED | User explicitly said: Leave six-human test pending. Automated clients are not human participants. | When user resumes this acceptance gate, run six humans on separate external networks with this exact artifact. |
| N02 | PASS — LOCAL AUTOMATED | Seventh active combatant rejected; late arrivals are spectator-only; bot slots counted independently. | See evidence in JSON. |
| N03 | PASS — LOCAL AUTOMATED | All socket+AI mixes totaling six validated, from 1+5 through 6+0. Socket drivers were automated. | See evidence in JSON. |
| N04 | PARTIAL | Public session API exercises create/code/ready/start/results/rematch; UI offline practice verified from both origins. | Create and join via copied invitation using separate browsers, then repeat rematch/leave. |
| N05 | PARTIAL | New client object reconnects with same identity, retained ammo and sequence floors; immediate firing accepted. Unit test prevents resurrection after expiry. | Run reconnect during combat/field damage and close to elimination under delay/loss. |
| N06 | PARTIAL | Local SDK owner-departure test confirms dedicated match survives. Online pause sends neutral input in source; offline menu pauses world. | Pause one online UI client while another observes continued field and vulnerability. |
| N07 | PARTIAL | Duplicate/old/nonfinite/oversized action fields and bounded queue limits covered; server rate caps exist. | Add delayed/reordered/duplicate socket traffic and assert bounded work and unchanged shot cadence. |
| N08 | PARTIAL | Local full-round records bounded 60-Hz scheduler and hostPerformance; this is not a WAN or load profile. | Run explicit latency/loss profiles and multi-room load; record correction and frame-time distributions. |
| N09 | NOT TESTED | New compiled integration has loopback server evidence only; older Supabase/Tag hosting is not evidence for this revision. | Use the previously authorized private test relay with matching hashes; obtain any newly needed access. Do not overwrite live games. |
| N10 | PASS — LOCAL AUTOMATED | Server maps connection identity to its actor; clients cannot submit another slot, damage, health, hits or outcomes. | See evidence in JSON. |
| G01 | PASS — LOCAL MAP INTEGRATION | Original Swoop scenery and canonical Detroit collision are connected to active compiled Royale; both games enter the same Atwater district and return to their own original maps. | See evidence in JSON. |
| G02 | PARTIAL | Mounted movement and aiming/fire use real rider/EUC assets; five rider rigs and wheel import in Blender and Unity. | Visually exercise each rider with maneuvering/aim/fire and verify sockets and mounted posture. |
| G03 | PARTIAL | Fixed battle handling and fixed hit volumes in source; normal riding retains its own profile. | Compare each skin's effective cover, weapon origin and hit eligibility; correct any geometry advantage. |
| G04 | PASS — AUTHORED DISTRICT | Six starts, 12 supplies and five field centers are clear on canonical Detroit physics; routes connect every start to each center. C++ centers match the actual map and survive snapshot restore. | See evidence in JSON. |
| G05 | PARTIAL | Touch layout, separate pointer owners and gamepad mappings implemented; narrow desktop viewport review is not device validation. | Test physical iPad/Android and gamepad with simultaneous move/aim/fire and rearm. |
| G06 | PARTIAL | Actual Elmwood cemetery gameplay and separate package retained; arena is a different route. | Compare saved settings/progress and finish an original-map regression walkthrough. |
| G07 | PASS — ARCHITECTURE | Royale rule/session path is separate from LOVE TAG and normal exploration; no civilian/companion target roster. | Keep Tag testing and Royale health/damage evidence separate. |
| G08 | PASS | Both package inputs preflight before isolated build output writes; staged packages and gate-off rollback documented. | See evidence in JSON. |
| G09 | PARTIAL | Separate actual product browser input, gate-off and error evidence recorded. Desktop samples around 60 fps are brief observations, not hardware guarantees. | Profile both original maps and Royale on target hardware with sustained p95/p99 frame times, load times and graphics fallback. |
| G10 | PASS | This task created isolated staging only and did not commit, merge, push, promote production packages, deploy or activate paid services. | Keep live deployment gated on explicit authorization. |
