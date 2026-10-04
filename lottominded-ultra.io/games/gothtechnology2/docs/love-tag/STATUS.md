# LOVE TAG: Heart Rush — implementation checkpoint

## Production integration — October 4, 2026

PR #60 contains the authorized static release. Its initial source commit is `e4da93e6c0801734d980fedd947c8dde8fee5406`. Production advanced through PR #59 to `0d151b9d95a49094bb129de1691941a27705c765` (implementation `f30be10230238f65e61ea6142b7cd81b00bb62b0`). The release now integrates those electric vehicles, hero emblem, walking motion, photographers, sharing and streaming changes with this chat's full-map LOVE TAG, Expert race fill, road joins and simpler menus. Both source projects remain separate. Existing actual Explorer files changed by integration were archived before copying the 32 selected source/asset files; unrelated divergent files remain untouched. Two blocking untracked NVIDIA files were archived, not deleted.

Commands after integration: Swoop `npm run check` and actual Explorer `tsc -p tsconfig.riverwalk.json --noEmit` PASS; 27 selected Swoop tests and 15 actual Explorer race/streaming/detail tests PASS. Two additional actual Creek Lane Expert pack tests PASS: three selectable EUC models and three electric bicycles each earn every gate with zero recoveries. Four electric asset sharing regressions PASS, including equivalent local texture references and rejection of different pixels before mutation. See `production-merge-*-20261004.log`.

`node scripts/build-riding-games.mjs`, the release revision recorder, Store build and root `node scripts/build-pages-artifact.mjs` PASS. The assembled artifact is 1021.7 MiB / 2502 source files, below the 1024 MiB limit. It shares eight identical electric models after verifying geometry and referenced texture pixels. New game entry modules are `detroit-CEyb3LjB.js` and `elmwood-DC9dAfSM.js`. The approved 8212 preview has these exact assembled game directories with only its local server URL changed. The full two-human rounds and server-stopped offline round evidence below was captured BEFORE production integration; it must not be silently attributed to the new module hashes. Focused merged-package browser checks are recorded separately.

Focused merged-package browser review PASS: actual Swoop Talaria and actual Explorer City 16 rides render, fresh tabs report no warnings/errors, both create distinct real loopback rooms with valid invitations, active server snapshots show one human plus three moving bots on the canonical full-map hashes, and the new Main menu exits both sessions back to their ordinary menus. Explorer's actual 390 x 844 menu has no horizontal overflow. The Swoop viewport override did not affect the targeted tab; its cropped image is NOT counted as a new phone pass. Earlier Swoop phone evidence remains explicitly pre-integration. See `evidence/browser-merged-package-20261004.json`, `elmwood-merged-menu-phone-20261004.png` and `elmwood-merged-city16-20261004.png`. These quick one-human room samples are not a repeat of the earlier two-human complete rounds.

Static publication remains pending PR checks/merge/Pages completion. Hosted internet LOVE TAG remains BLOCKED by the missing authorized persistent HTTPS/WSS endpoint. Full human course/map/collision traversal, physical phone/controller/VR, eight-player GPU metrics and ordinary online Explorer races remain unfinished. Exact next runnable task: complete the merge commit on upgrade-redesign, push PR #60, await its checks and authorized Pages deployment, then verify public entry/module hashes. Concurrent unstaged mural, photography exhibition and Penny Exchange changes are preserved separately and are not included in this scoped release.

## Approved current browser review — October 4, 2026

The user explicitly approved reopening localhost:8212. Browser access succeeded; the earlier access blocker is resolved. Two UI-driven browser clients created/joined a real authoritative room in EACH actual product, independently drove the guests while hosts stayed still, completed Classic rounds, accepted rematches and returned to the normal menus. Both rematches recorded a confirmed tag. Actual Explorer recovered the same player ID after the documented five-second connection interruption. Evidence: `evidence/browser-two-human-polish-20261004.json` and the current phone menu screenshots. This is loopback evidence, not a LAN, hosted internet, every-course or every-hiding-place pass. Swoop's five-second reconnect remains SDK-tested; its browser reload experiment was not completed inside the grace window.

The review found and fixed an actual Explorer fixture URL defect: `.gz` was appended after the package cache query. Shared fixture loading now appends it to the path before query/fragment; native-stream and fflate URL regressions pass (2 tests). Current source and portable Core builds pass. Phone chat is raised above riding controls, Tag UI resets inherited button sizing/margins, and the landscape map is smaller. The separately authored Elmwood skylight is calibrated to the prior environment's approximate spherical luminance; see `elmwood-skylight-calibration-20261004.json`.

Packaging initially failed the 1 GiB Pages limit. Canonical texture sharing now covers the existing riding cabinets and externalizes unique model images so the existing color/data-map-aware optimizer can inspect them. Authoring JSON, an obsolete unreferenced intro film and the separately packaged Explorer's replaced environment are retained in source but omitted from release. A complete Pages assembly passed at 1016.7 MiB; later UI rebuilds must refresh that artifact before publication. No original art is deleted. Current final package/source hashes are recorded by `record-full-map-revisions.mjs --release`.

Final paired build, Store build and the refreshed complete Pages assembly PASS (1016.7 MiB). The approved 8212 review was replaced with the exact assembled game directories; only its local server URL differs. Both load the new OptiX skylight and retained rider/scenery assets with zero reported streaming errors. Actual browser checks: Explorer portrait 369 x 844 CSS pixels, Swoop landscape 844 x 390; no horizontal overflow. Tag chat is above the portrait riding pads; the landscape map ends at y=250.7 and the first touch row starts at y=258. Resolution 50% changed the Explorer buffer to 138 x 316 / pixel ratio 0.375 and was restored to Preset. The server was then stopped and both actual browsers ran offline Classic with one human and three moving bots. Cruise moved the Swoop rider about 412 m and the Explorer rider about 67 m without a reset; these are samples, not a complete map audit. Evidence: `evidence/browser-final-package-phone-offline-20261004.json`, `browser-offline-moving-20261004.json`, phone/landscape PNGs, `polish-final-paired-package-20261004.log`, `polish-final-store-build-20261004.log`, `polish-publication-artifact-20261004.log`.

Remaining: scoped static release; full map/course/hiding/collision parity, physical hardware, eight-player frame metrics and ordinary online Explorer races are unfinished. Hosted LOVE TAG is still BLOCKED by the absent authorized persistent HTTPS/WSS service. Exact next runnable task: commit the scoped candidate on upgrade-redesign, push, create the main PR, await CI and authorized Pages deployment, then verify public entry/module hashes. Continue full-course traversal and collision parity after that release; do not infer hosted online availability from static Pages publication.

Final review follow-up: both offline Classic rounds reached tick 11160/results with the server stopped and returned to normal menus; `evidence/browser-offline-results-20261004.json`. Neither test human scored a tag in these offline samples. Swoop's portrait menu was also recorded at 390 x 844 with no horizontal overflow. A renderer warning identified deprecated PCFSoftShadowMap; both real renderers now explicitly use PCFShadowMap, the same fallback Three was already applying. Final paired builds, Store build and complete 1016.7 MiB assembly after this cleanup PASS; logs use `polish-final-shadow-*`. The approved review has been replaced with these exact assembled packages (local server URL only), and the local authoritative server was restarted after offline checks. No hosted service was started.

Final new entry modules `detroit-DU8hlhFx.js` and `elmwood-B7-7VCxi.js` loaded their menus, OptiX lighting and mapped assets. The captured browser log retains the earlier 19:43:56 shadow warnings from superseded module URLs; no new warnings/errors were observed after the final reload. `evidence/browser-final-shadow-package-20261004.json` preserves that distinction instead of discarding earlier warnings.


## Latest increment: both-games polish and NVIDIA authoring
October 4, 2026. Both real source projects typecheck. Swoop and the separately packaged Explorer have rebuilt local release candidates. **Static GitHub publication is still pending; hosted LOVE TAG remains BLOCKED.** The approved browser review above supersedes earlier access-blocked entries.

- Same-grade city road/path overlays are clipped, shared sidewalk/curb miters remove bend gaps, and coarse support triangles no longer paint asphalt fringe near mapped roads. A terrain tile index bounds road tessellation lookups. 14 real geometry/Atwater/grade/fringe tests PASS (global-surface-joins-index-final-20261004.log).
- Actual Explorer's menu is reduced to clear ride/race/Play/Practice/LOVE TAG choices with secondary options collapsed. Swoop's simpler lobby is preserved. Existing controls/settings and saved touch layouts remain.
- Both Tag host branches now update scenery/terrain streaming, lighting and automatic detail at their locally predicted/authoritative rider. Swoop Tag no longer uses the paused ordinary ride's 30 Hz idle schedule. New sceneFocus/isActive getters are included in real and portable Core builds.
- Blender 5.2 successfully rendered original separate urban/grass daylight-ground environments using NVIDIA OptiX on the RTX 3080. Two 1,024 x 512 / 64-sample bakes took 3.72/3.75 seconds. Runtime remains Three/WebGL; no driver preferences, plugin install, paid job or engine migration.
- CPU mapped-ribbon benchmark reduced 387,152 to 356,555 triangles over 28,764 segments; construction work increased in that sample (11.290/13.367 seconds after indexing). This is NOT a measured GPU frame-rate improvement.
- Actual commands: NVIDIA catalog list/fallback, headless Blender script, selected Node geometry tests/benchmark, Core/portable Core npm builds, Swoop npm run check and actual Explorer tsc -p tsconfig.riverwalk.json --noEmit. Paired build then final Swoop rebuild PASS. See ../BOTH_GAMES_POLISH.md and ../CHAT_REQUEST_CHECKLIST.md.
- Browser approval was granted and the scoped current checks above ran. Complete map playthrough and physical-phone performance are still not verified.
- Exact next task: publish the authorized scoped GitHub Pages release and verify public assets. The approved scoped local browser checks above are complete; full-map traversal, hosted WSS and standalone Explorer ordinary online racing remain separately unfinished.

## Latest increment: multiplayer controls, chat and authorized static release

October 4, 2026. The user explicitly requested push live, superseding the earlier no-deployment scope for static packages. **Release candidate built; hosted LOVE TAG verification remains BLOCKED.** Do not claim this chat's entire acceptance matrix is complete.

- Swoop online riding/races now default to one locally owned camera. Settings offers optional split view, and only owned panes have independent captured touch pads. My display offers device-local resolution/FPS, including 50 percent rendering. Actual Explorer receives the same device-local display controls in LOVE TAG. Local split play stays available.
- Multiplayer chat is wired into Swoop's existing Realtime rooms and the dedicated LOVE TAG client in both games. Chat is plain text with a 160-character maximum, per-sender rate limiting, local mute and ephemeral history. Opening chat releases movement and suppresses local commands while typing. The authoritative Tag server assigns sender identity; legacy invited Realtime rooms retain their existing host/broadcast trust model.
- Swoop's optional race fill makes four riders with distinct existing EUC skins, explicit AI labels and Expert/Club choices. Each AI uses the actual controller/terrain/course and must earn all checkpoints. Actual Explorer receives Expert local racers and distinct EUC rival skins. Its normal online race mode is still absent; online LOVE TAG is implemented.
- Swoop minimap labels YOU and participating riders/AI. Tag map marks the local rider and visible opponents only, retaining fair hiding behind cover.
- Full-map Swoop authoring JSON is 145 MB. The released fixture is 33 MB gzip; native stream and fflate fallback both decode the same canonical hash. The server reads gzip directly. A versioned ride-core source snapshot and portable server dependency/Docker context make server code reproducible from this repo.
- Fixed the actual Explorer invalid mountedVolume assignment, using the supported wheelScale profile. Both typechecks now pass. Packaged upstream @better-auth/utils MIT notice with recorded provenance; no missing runtime notice placeholders.

### Commands actually executed for this increment

| Root | Command | Result / log |
|---|---|---|
| Swoop | selected multiplayer/protocol/touch/split tests | 22 PASS; multiplayer-controls-20261004.log |
| Swoop | onlineRaceFill.test.ts | 1 PASS, all three actual AI finish 12 gates; online-race-fill-20261004.log |
| Swoop | spatialAssetStream, crowdIntelligence, mackParkingLayout tests | 9 PASS; map-stream-traffic-20261004.log |
| Actual Explorer | elmwood-race.test.ts | 8 PASS; elmwood-expert-race-20261004.log |
| Swoop | npm run check | PASS; multiplayer-swoop-final-20261004.log |
| Actual Explorer | tsc -p tsconfig.riverwalk.json --noEmit | PASS; multiplayer-elmwood-riverwalk-final-20261004.log |
| Server | TAG_DIFFICULTY=expert node tests/map-ai.mjs | both maps/rules finish, zero illegal ticks/resets; tag-expert-full-map-20261004.log |
| Server | node tests/chat.mjs | both products PASS, real loopback SDK clients; multiplayer-chat-20261004.log |
| Existing Realtime | two SDK clients subscribe/send/receive/leave random QA channel | PASS; swoop-realtime-chat-20261004.log |
| Core | native/fallback decoding actual canonical gzip maps | 4 PASS; full-map-gzip-20261004.log |
| Portable Core/server | npm ci; npm run build | PASS; portable-*-final-20261004.log plus portable-core-*.log |
| Packaging | node --test scripts/game-package.test.mjs | 5 PASS; package-notice-20261004.log |
| Packaging | node scripts/build-riding-games.mjs | both actual packages PASS, retained previous outputs; multiplayer-release-build-final-20261004.log |
| Packaging | node docs/love-tag/record-full-map-revisions.mjs --release | 48 source and 8 canonical entry/module hashes, fixture copies match; multiplayer-release-revisions-20261004.log |
| Store | npm run check:store; npm run build | PASS; release-store-check-20261004.log, release-store-build-20261004.log |

Broad Explorer tsconfig failure and the first invalid mountedVolume implementation were repaired with the product config; failed logs retained. Portable server installation first failed because the running server locked node.napi.node; stopping the owned process and reinstalling/building passed. GitHub sign-in initially could not save inside the sandbox. User completed GitHub's authorization; approved host execution accesses the saved keyring, while sandboxed gh cannot. No token was displayed.

### Remaining work and exact next runnable task

1. Publish the scoped upgrade-redesign release, merge through a PR into main, await successful Pages deployment and verify exact public assets. Current public status must be recorded after it happens.
2. After explicit approval for the blocked local browser access, complete current full-map human races/LOVE TAG playthroughs and phone-size controls/chat/display/split checks in both actual products. Source tests are not visual evidence.
3. Supply an authorized persistent HTTPS/WSS service and exact client origins; deploy the prepared server with its compatible fixtures. Complete separate-device/network hosted rounds, reconnect/rematch/exit. Hosting is not provisioned or paid for automatically.
4. Complete the remaining NOT RUN matrix cases: all permitted graph edges/scenery cover, weapon/body/camera variation, role/range/ammo boundary permutations, full input/focus/security/disconnect/latency/capacity/resource/performance acceptance.
5. See ../CHAT_REQUEST_CHECKLIST.md for earlier chat requests and explicitly unfinished items. No background work is claimed.


## Latest increment: full selected maps, October 4

**LOCAL REVIEW / INCOMPLETE ACCEPTANCE / NOT DEPLOYED.** This section supersedes the small-arena hashes and bot failures in the historical checkpoint below. The user subsequently requested missing multiplayer split controls and independent device resolution; that repair is in progress and must receive its own evidence.

- LOVE TAG now uses the actual complete supported terrain in both products: Swoop's 3,102 × 2,102 m export and the separate Explorer's 801 × 1,033 m export. Open lawns and courtyards are legal beyond the old lane/arena limits. These are bounding dimensions, not a claim that every cell is land. Actual unsupported ground and water remain closed.
- Masked-ground body sweeps stop before an invalid edge and allow backing away. Hearts and sight use real collider queries; the support mask does not become an invisible projectile wall. Navigation excludes rejected isolated endpoints; bots retain exploration memory and finish slow turns before choosing another goal.
- Swoop's shop shells, fixtures, floors and freight-container collision registration is shared between the visible game and fixture exporter. LottoMind's two entrances are open and its side wall blocks heart-sized sweeps. Remaining runtime-added rails, furniture, waterfront decks and vegetation require a complete collision parity audit; this increment does not claim all scenery parity.
- Added a Tag minimap/full map and cover-dependent opponent markers/labels; no through-wall markers. Opening map/menu releases movement, and map Escape returns to riding. Offline launch/Create/Join stay disabled until fixture loading finishes. Bot difficulty is sent to the authoritative service. New map UI browser appearance is BLOCKED, not visually verified.
- Standalone Explorer race Recover now uses the last earned checkpoint, keeps gate/score/splits/time, retains the get-up delay after a fall, and refuses blocked launch positions. Its actual source and the specifically changed mirror files were updated; unrelated mirror differences remain preserved.
- All new outputs are under `.game-builds/love-tag-review`. Source/client/server fixture copies and compressed copies match. Source revisions and canonical HTML-linked module hashes are in `evidence/full-map-revisions-20261004.json`: Swoop arena `8692124ce27f6b62ce39f669d5e53832a10a716862fddcc6b73518a4b1521329`; Explorer `81394a54680a00577d94367d07f455cae77cd9cacbbfb4e8b20806a9bb50600b`, revision `20261004.full-map.3`. No original/live output, commit, push or hosting was changed.

### Actual full-map commands and evidence

All logs below are in this directory. Windows / Node 24.16 / Core 1.2 / Three 0.185.1 / Rapier 0.20 are retained.

| Root | Executed command | Result and log |
|---|---|---|
| Core | `npm run build` | PASS |
| Core | `node --experimental-transform-types --test tests/tag.test.ts tests/tagTerrain.test.ts tests/fallMotion.test.ts tests/motionV2.test.ts` | 32 PASS; `core-full-map-boundary-regression-final-20261004.log` |
| Packaging | `node --experimental-transform-types scripts/export-love-tag-fixtures.mjs swoop-detroit` | PASS; 1,220 static colliders, full-map mask; `full-map-cover-export-20261004.log`. Initial invocation without transform-types failed and was repaired. |
| Packaging | `node scripts/cache-love-tag-navigation.mjs` | PASS, build-time physical graph validation and clear eight-seat cluster; `full-map-cover-boundary-navigation-20261004.log` |
| Server | `node tests/full-map.mjs` | Both PASS: actual commands move on far open ground (2,878 m / 1,055 m from launch), boundaries, eight clear independent spawns, real solid cover; `full-map-controls-v3-final-20261004.log`, `evidence/full-map-20261004.json` |
| Server | `node --experimental-transform-types tests/store-cover.mjs` | PASS side wall plus both entrances; `full-map-store-cover-20261004.log` |
| Server | `node tests/map-ai.mjs` | Both products/rules PASS: 0 illegal bot ticks, 0 bot resets. Classic bot distances 610–677 m / 443–572 m, 88–100 / 50–63 visited nodes. Explorer Spread legitimately ended when all caught at 12.62 s; other runs completed the canonical timer. `full-map-ai-commitment-final-20261004.log` |
| Server | `npm run build`, `TAG_BIND_HOST=127.0.0.1 node dist/server.js`, `node tests/local-online.mjs` | 4 PASS with current hashes: actual Colyseus server plus 2 independent SDK clients per scenario, server tags, five-second reconnect, authoritative results, rematch and clean leave; `full-map-online-v3-final-20261004.log`, `evidence/local-online.json` |
| Swoop source | `npx tsc --noEmit`; selected race/store/layout Node tests | PASS; 18 tests, `full-map-swoop-typecheck-20261004.log`, `full-map-swoop-race-stores-20261004.log` |
| Actual Explorer | `npx tsc -p tsconfig.riverwalk.json --noEmit`; race + recovery tests | PASS; 8 tests, `elmwood-race-recovery-final-20261004.log` |
| Packaging | `node --test scripts/elmwood-touch-layout.test.mjs` | 4 PASS; `full-map-touch-layout-20261004.log`; saved layout fitter component, not physical touch evidence |
| Packaging | `node scripts/build-love-tag-preview.mjs`; `node docs/love-tag/record-full-map-revisions.mjs` | Both real review packages built; source/compiled/fixture copies recorded and matched. `full-map-review-build-20261004.log`, `full-map-source-revisions-20261004.log` |

Failed intermediate bot runs are retained in `full-map-ai-final-20261004.log`, `full-map-ai-boundary-final-20261004.log`, `full-map-ai-roaming-final-20261004.log`; the first edge failure trace is `full-map-ai-trace-swoop-20261004.log`. A successful simulation does not establish that all permitted edges were human-played.

### Current verification boundaries and next runnable task

- **PASS:** sampled actual-terrain movement/cover, canonical offline bot simulations, current loopback actual-server/independent-SDK rounds. No fake online transport or split view substituted for Tag networking.
- **BLOCKED:** current full-map browser playthrough and phone-size browser checks. Automatic approval review rejected reload/access to the local 8212 review page, then rejected reopening it as bypassing that decision. Browser actions stopped; no alternative browser, port or original build was used to evade it. Explicit user approval is required before any retry. Older browser evidence below uses the older smaller arena and does not verify this increment.
- **NOT RUN:** a human traversing every region of both full maps, every hiding corner/costume/obstacle, complete scene collision parity, new map HUD clipping/phone responsiveness, physical phones/gamepad/VR, eight-rider performance, latency/jitter/resource profiles. Compressed Swoop collision data is still about 33 MB; no mobile frame-rate claim.
- **BLOCKED hosted/LAN:** no authorized HTTPS/WSS staging endpoint or separate-network/device evidence. Loopback is not LAN/hosted internet. Hosting credentials did not omit server/client code.
- **Exact next runnable task:** finish the newly requested split-control/device-resolution repair in source and test/build it. Then, after explicit approval for the blocked browser access, open the 8212 review entries and complete full-map LOVE TAG playthroughs, close-range cover checks, full human race/recovery/retry and 390×844 / 844×390 UI checks. Preserve originals and do not deploy without fresh scope authorization.

## Historical checkpoint before full-map increment

Updated October 4, 2026, America/New_York. EXECUTION_SCOPE=CORE_RELEASE. **INCOMPLETE / LOCAL REVIEW ONLY / NOT RELEASED.** This is a usable checkpoint, not a claim that all acceptance requirements or background work are complete.

Latest focused repair: Swoop's Chene Park pond-edge trap. `swoop-source/src/detroit/controller.ts`, `recovery.ts`, `world.ts` and new `water-recovery.test.ts` now permit uphill escape from an existing wet-bank pose, preserve motor buildup against bank gravity, reject water across the recovery footprint and align pond blocking with the visible -0.18 m surface. Session distance and score are preserved; reachable dock/bridge ground stays rideable. Typecheck and 32 controller/recovery/race tests passed (`shoreline-recovery-20261004.log`). Only Swoop's separate 8212 review package was rebuilt. The user's existing 4181 rider was moved onto land with its existing Recover button and left paused, preserving 623 points and 453.4 m. The new package was driven from The Aretha entrance using Cruise and recovered via the UI; separate before/after data are in `evidence/shoreline-recovery-20261004.json`. Exact reported-bank reverse is tested with the actual Rapier map, not claimed as a manually held browser-key ride. No live/original package was overwritten. See `../SHORELINE_RECOVERY.md`.

## Real sources and revisions

- Packaging project: C:/Users/digit/Documents/phone/_goth_swoop_release_20260916/lottominded-ultra.io/games/gothtechnology2.
- Swoop editable runtime: swoop-source/src/detroit/main.ts within that project.
- Actual separately packaged Elmwood Explorer: C:/Users/digit/Documents/phone/euc-detroit-riverwalk/src/detroit/elmwood.ts and elmwood-ride.ts. elmwood-source is a partial packaging mirror; Swoop's internal Elmwood map is not a substitute.
- Shared runtime: C:/Users/digit/Documents/phone/Digital_Static_RideCore, version 1.2.0. Three 0.185.1, Rapier 0.20.0, Node 24.16.0 retained.
- Starting repository HEAD was aeb36453d24b1ab30798a2af78809bc639070aac. HEAD advanced externally during this run to 9f6f2cbcf2aea87a22a123fdd23bddcacea69797 on upgrade-redesign. This run did not commit, push, deploy, reset or clean. Remaining unrelated dirty changes are preserved.
- Current individual source/build hashes: evidence/race-water-revisions-20261004.json. It records the actual project, changed mirror files, Core, server source/built module/tests/fixtures, builders, canonical HTML-linked assets and arena files. Actual Explorer and Core have no separate Git revision available; their individual SHA-256 source hashes establish identity. It does not assert that every file in the old mirror matches the actual project. Pre-existing differences in dogCommandHud.ts and elmwood-walkers.ts are preserved; the builder uses the actual project.
- Swoop arena hash: 71b7fee49b94129344e2ea5dd3a63250af7983e5ae32e8459e90a9873babc59e. Actual Explorer: dab18d0638db3746073199e1ee8d3cde01d2a14ef80539e899fc94eb5cfdcc35, revision 20261003.2 following creek grave thinning.
- Previous October 3 status/matrix archived as STATUS-20261003-checkpoint.md and TEST_EVIDENCE-20261003-checkpoint.md. Older failure logs and receipts are retained.

## Implemented

The real Colyseus authoritative service and shared client remain implemented for Classic and Spread in both actual products: Create/Join, private codes, product-specific invitation links, independent players, validated movement/heart/contact tags, synchronized roles/time/ammo/results, server bots and optional fill, spectators, reconnect grace/seat policy, rematch and exit. Offline explicitly uses the shared local match rather than a socket or fake online transport.

This increment fixed real browser flow issues: menus close when rounds/rematches start; invited clients show the correct rules; online menus release input and explain that the rider remains taggable; touch taps are buffered; Cruise/Resume are available; disconnected seats can rejoin with tab-local session data; a five-second review interruption uses the actual SDK; a pending review reconnect cannot resurrect an exited game. Reset is retained across blur/menu closure. The server now latches reset/hop/burst until a simulation tick instead of losing them when another command arrives first. Previous results and status messages are cleared on a new session/rematch, and Start is hidden during an active round.

The related race increment fixed Swoop's invalid extra opponent and added a real three-opponent race to standalone Explorer. Faster committed bicycle passes, drag compensation, live actor avoidance and interleaved fixed steps prevent pack stalls. Explorer bicycles physically reverse around blockage. Both products retain their distinct real courses, ordered checkpoints, course maps, recoveries, finish and retry. The race has no time cutoff; the trick session keeps its two-minute limit.

Bicycle fitting keeps elbow bend while maintaining real grip/pedal contacts. Existing EUC arm balance, bike lean and crash/settle behavior are retained and tested; newly authored fall artwork is not claimed. Explorer water now has downstream creek flow, small pond waves, moving normals, depth/shore shading and rain/fountain ripples. Pause/reduced motion freeze its water clock; graphics quality controls detail. No waterfall model was added.

Phone improvements preserve saved touch layout data while resolving current viewport overlap. Explorer's landscape HUD sits above the joystick. Swoop race feedback and its map fit side by side in portrait; the compass has a clear lane. Recording remains available in Settings. Dog commands start collapsed on phones, with a 44px expand target. Current Night Sentinel assets are copied from the real project into both review packages.

See ../RACE_WATER_POLISH.md for changed race/water files and remaining player-course checks. Related earlier blossom, creek grave, race-map and waterfront exclusions remain preserved; see their dedicated briefs.

## Actual commands and results

Commands below ran in the named root. Logs are under this docs/love-tag directory; intermediate failures are retained rather than overwritten as successes.

| Root | Command | Actual result / log |
|---|---|---|
| RideCore | npm run build | PASS after final client changes |
| RideCore | node --experimental-transform-types --test tests/tag.test.ts | 11 PASS; core-actions-final.log, including batched one-shot input regression |
| Swoop source | node --experimental-transform-types --test src/detroit/race.test.ts | 17 PASS; race-swoop-roster-final.log |
| Actual Explorer | node --experimental-transform-types --test src/detroit/elmwood-race.test.ts | 6 PASS; race-elmwood-backoff-final.log |
| Actual Explorer | node --experimental-transform-types --test src/detroit/elmwood-bicycle-fit.test.ts src/detroit/ride-motion.test.ts | 8 PASS; motion-elmwood.log |
| Actual Explorer | node --experimental-transform-types --test src/detroit/elmwood-riding-polish.test.ts | 4 PASS; riding-polish-current.log |
| Actual Explorer | node --experimental-transform-types --test src/detroit/elmwood-water.test.ts src/detroit/elmwood-landmarks.test.ts | 7 PASS; water-and-landmarks-final.log |
| Packaging project | node --test scripts/elmwood-touch-layout.test.mjs | 4 PASS; touch-layout-final.log |
| Swoop source | npx tsc --noEmit | PASS |
| Actual Explorer | npx tsc --noEmit -p tsconfig.detroit.json --types vite/client | PASS; broader root typecheck has pre-existing test/import-meta configuration failures |
| love-tag-server | npm run build; then node dist/server.js | PASS; actual local server on 8211, restarted after one-shot latch fix |
| love-tag-server | node tests/local-online.mjs | 4 PASS after latch fix; local-online-actions-final.log and evidence/local-online.json |
| love-tag-server | node tests/map-ai.mjs | Metrics completed; acceptance FAIL; actual-map-ai-final.log and evidence/actual-map-ai.json |
| Packaging project | node scripts/build-love-tag-preview.mjs | PASS; latest build-local-final.log; separate review outputs only |
| Packaging project | node docs/love-tag/record-race-water-revisions.mjs | Current source/canonical package hashes recorded; 13 specifically checked mirror files match |

Earlier real fixture export and street-furniture tests are documented in the archived checkpoint. No external library recommendation or download was introduced for this polish increment.

## Actual browser and local multiplayer evidence

Windows Codex in-app Chromium, effective viewports recorded in receipts. Exact browser version and physical-device input are not captured. HTTP 8212 and actual WebSocket/service 8211 are on the same computer. **Loopback evidence is distinct from LAN and hosted internet evidence.** No latency/jitter emulator was used, and reconnect tokens/secrets are not written into receipts.

- BOTH products: two separately controlled browser clients created/joined real rooms. Each independently steered, aimed and fired, with distinct session IDs and server shot events. Classic humans-only and Spread two-human/two-bot rounds completed with identical authoritative results. Product-specific invitation links were followed to the correct actual nested entry/arena.
- BOTH products: an actual five-second socket interruption showed the disconnected rider as a taggable reconnect proxy, then restored the same seat/round. Canonical results and a new rematch round were seen by both clients. Back to game restored the normal menu and cleared Tag state. Complete resource/leak stability is not established by that visual restoration.
- Swoop Classic: room B1D7A75E, round ea3f647e-f8e2-4730-ae90-7704e5b3dd38. Explorer Classic: room 8B15160A, round ef9bffa2-c344-4fef-bd4d-57ce5188e0ff. Both 2 humans / 0 bots.
- Swoop Spread: room 5B8C0C69, round f12ef374-1082-49d1-8073-3cf1aa3bcecd ended with all caught. Explorer Spread: room D66D2F6D, round 52104e92-3fc6-46a6-8345-89e6afd3ee28 ended at the timer. Both 2 humans / 2 labeled server bots.
- Final latch verification: actual Explorer room 0BD2850C and Swoop room 8BBB4983 recorded each human's distinct shot events and exactly one reset for each reset action. See evidence/two-browser-20261004.json, including failed reset evidence before the repair.
- Latest SDK test repeated all four product/rules combinations against the rebuilt server after the latch fix; client-only status/layout follow-ups do not change server rules.
- Full real-browser rival races: all three Swoop bicycles completed all 12 gates to Mack, 371.35–384.28s. All three Explorer bicycles finished Creek Lane with zero recoveries. Human players stayed at their grids. A manual human drive over every course/gate/obstacle/recovery/finish is **NOT RUN**, not inferred from these rival runs. See evidence/race-pack-browser-20261004.json.
- Portrait 390x844 and landscape 844x390 layouts inspected. Solo controls/map are separated; existing 82px Explorer Hop remains saved. The backend pads screenshots beyond the effective viewport, so use receipt dimensions. Concurrent physical fingers/thermals remain untested. See evidence/water-phone-browser-20261004.json and session screenshots.
- Actual pond water rendered. Pause held waterTime at 389.28 across separated observations. A new actual pond view with reducedMotion=1 held waterTime at 0.00 across separated observations; component tests also cover reduced motion. Existing nature evidence is separate.
- Actual offline Classic and Spread completed in BOTH products with one human/three local bots and no room. Human steering/aim/fire input was exercised in Classic. Spread ended at the timer in Swoop and with all caught in Explorer. Offline rematch cleared previous results; exit restored both normal menus. See evidence/offline-browser-20261004.json. Completing rounds does not clear the A01 navigation failure.

## Failed, blocked and untested work

- **A01 FAIL**: Tag bot navigation is separate from the normal race pack. The retained actual-fixture test has an Explorer Classic bot with 360 illegal-lane ticks and two recoveries. Swoop's sample travels 663–702m with zero illegal ticks/recoveries but does not cover every permitted route edge. Offline browser bots also recover; full Tag navigation acceptance is not complete. Unsuccessful tuning experiments were reverted rather than shipped as a claimed fix.
- **D02 BLOCKED**: runtime notices were collected, but installed @better-auth/utils has no license notice. Metadata is retained as MISSING-NOTICE; upstream notice/provenance still requires verification before release.
- **H01–H03 BLOCKED**: no authorized hosted HTTPS/WSS endpoint/credentials and no separate-network devices for hosted verification. The server/client code and DEPLOYMENT.md are delivered; missing hosting did not omit online implementation. No paid hosting or deployment occurred.
- **NOT RUN**: manual human full courses; simultaneous real thumb controls; complete eight-rider/performance/latency profiles; physical gamepad/VR; full costume/muzzle/vegetation/vertical-cover permutations; complete rejection/security/focus-loss/host-transfer/seat-expiry policies; repeated resource stability and full settings/audio/save regression; Docker/hosted rollback execution. Matrix rows preserve these limits.
- Packages remain heavy, with a Vite chunk warning and roughly 275MB Explorer assets. Multiple open browsers are not a mobile performance measurement. No mobile frame-rate claim is made.

## Run and exact next runnable tasks

See DEPLOYMENT.md for environment/config requirements. Existing review servers were started in this run, but no work continues after this response. Restart if needed:

1. In RideCore run npm run build.
2. In love-tag-server run npm run build, then node dist/server.js (default port 8211).
3. In the packaging project run node scripts/build-love-tag-preview.mjs, then node scripts/serve-love-tag-preview.mjs (loopback 8212).
4. Open the Swoop entry /Jungle-Lotto/lottominded-ultra.io/games/gothtechnology2/arcade/swoop-detroit/ and the actual Explorer entry /Jungle-Lotto/lottominded-ultra.io/games/gothtechnology2/arcade/elmwood-explorer/elmwood.html.

**Next priority:** drive the human racer through each full course, intentionally miss a gate, fall/recover, finish and retry; record actual interactions and repair remaining errors. Then instrument the failing Explorer Tag bot segment in node tests/map-ai.mjs and add legal-lane assertions for both fixtures. Complete remaining offline/input/resource checks and physical phone playtests. Hosted verification follows only after explicit staging authorization and a real HTTPS/WSS service plus separate-network devices are available. Do not promote the review packages or overwrite live builds automatically.
