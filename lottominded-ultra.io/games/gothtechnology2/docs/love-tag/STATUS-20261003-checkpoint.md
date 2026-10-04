# LOVE TAG: Heart Rush — usable implementation checkpoint

Updated October 3, 2026 (America/New_York); evidence timestamps use UTC. Scope CORE_RELEASE. **INCOMPLETE / LOCAL REVIEW ONLY / NOT RELEASED.** No automatic/background completion is claimed.

## Sources and revisions
- Swoop editable source: C:\Users\digit\Documents\phone\_goth_swoop_release_20260916\lottominded-ultra.io\games\gothtechnology2/swoop-source/src/detroit/main.ts. Repository branch upgrade-redesign, HEAD aeb36453d24b1ab30798a2af78809bc639070aac; working changes are uncommitted.
- Actual standalone Explorer: C:/Users/digit/Documents/phone/euc-detroit-riverwalk/src/detroit/elmwood.ts and elmwood-ride.ts. Packaging mirror: elmwood-source. This is distinct from Swoop's internal Elmwood map.
- Shared engine: C:/Users/digit/Documents/phone/Digital_Static_RideCore, version 1.2.0; Three.js 0.185.1 and Rapier 0.20.0 retained.
- Exact dirty-file SHA-256 receipt: evidence/source-revisions.json. Fixture identities are in evidence/local-online.json and evidence/actual-map-ai.json.
- Existing unrelated game/storefront/camera/animation/audio work preserved. No reset, clean, commit, push, deployment, paid provisioning or generation performed. Original store/public arcade outputs were not promoted or overwritten.

## Implemented, with remaining acceptance work
- Injected Tag handling and nested controller JSON capture/restore, without changing normal defaults.
- Shared Classic/Spread fixed-step rules, one-It invariant, locks/epochs, continuous heart/target collision, cover tests, authoritative contact/projectile tags, ammunition/regen/burst, penalties and final results.
- Exported arenas from the real map physics/heights, and bounded server-controlled navigation/perception/aim. Navigation has improved substantially; Explorer still has a legal-boundary failure and full-edge coverage is not established.
- Actual Colyseus service: private room codes/lookup, join/create, ready/start, fixed simulation, server bots/bot fill, spectators, invitations, reconnect grace/seat takeover, host transfer, rematch/leave, limits and protected operations telemetry.
- Both real game menu/render/input adapters use the shared client. Offline is explicit and needs no service. Online accepts the host-owned HTTPS/WSS configuration, not an invitation-supplied endpoint. Client predicts its own movement and interpolates remote authority. Rendering, hand placement and complete input/device cycles remain acceptance work.
- Local review packaging uses separate .game-builds/love-tag-review outputs. No fake room menu, split-screen substitute or local fake transport was used for the recorded network tests.
- Related local fixes: dry-ground exclusion now includes Milliken Harbor for trees/lamps; startup placeholder replaces the old preboot form flash; standalone Elmwood has a compact corner map/compass, simpler toolbar and collapsed Group ride panel while retaining saved touch layout editing.

## Changed file groups
- RideCore: controller.ts, balanceEngine.ts, rideDynamics.ts, src/tag.ts, src/tag/{fixture,rules,navigation}.ts, src/tagClient.ts, tests/tag.test.ts, package.json/lock and built dist.
- Swoop: main.ts adapter, dryStreetSite.ts, placement/scenery/furniture exclusions and furniture tests, bootUi.ts/detroit.html startup, tacticalHud.css compass scope, public/love-tag, package/config files.
- Actual Explorer and mirror: elmwood-ride.ts adapter, elmwood.ts, elmwood-session.css, new elmwood-mobile-hud.css, tacticalHud.css, public/love-tag and build config.
- love-tag-server: src/server.ts, fixtures, package/lock/tsconfig, local-online.mjs and map-ai.mjs, README, Dockerfile, proxy/environment examples.
- Packaging scripts: fixture export, both product builders, preview builder/server and game-package.mjs runtime notices.
- docs/love-tag: supplied master/matrix, STATUS, TEST_EVIDENCE, DEPLOYMENT, logs and evidence. Separate docs/MONORACE_RACE_RESEARCH.md records the user's new race reference; those proposed race upgrades are not implemented.

## Commands actually run and results
- RideCore npm install and npm run build: PASS after type repair. Node v24.16.0.
- node --experimental-transform-types --test tests/tag.test.ts: **10 PASS, 0 FAIL**, latest controller/rules. See core-tests.log. These are deterministic component tests, not complete browser acceptance.
- node --experimental-transform-types scripts/export-love-tag-fixtures.mjs: PASS after source-path and mixed-Rapier initialization fixes. Swoop fixture 80 lane edges/40 anchors/26 colliders; Explorer 103/40/652.
- love-tag-server npm install / npm run build: PASS after transport version corrected to 0.18.4. Service launched with node dist/server.js on port8211.
- love-tag-server node tests/local-online.mjs: **PASS** for Swoop Classic, Swoop Spread, Explorer Classic, Explorer Spread; two independent actual SDK sessions, real codes, independent commands, server-confirmed tags, identical results, five-second disconnect/reconnect and a new rematch round. Humans-only Classic and mixed human/server-bot Spread. See local-online.log and evidence/local-online.json. This ran before the final AI route tuning; it is not a two-browser human playtest or hosted test.
- node tests/map-ai.mjs: completed all four real-fixture scenarios. It collects metrics rather than asserting all acceptance gates. Initial failed metrics retained in actual-map-ai-failed-first-pass files. Latest Swoop bots traveled663–702m with zero illegal ticks/recoveries; Explorer Classic one bot had360 illegal ticks and two recoveries. **A01 remains FAIL.** See actual-map-ai.log/json.
- Swoop streetFurnitureLayout tests: three passed, including dry harbor/river placement predicates. This does not constitute a waterfront visual pass.
- node scripts/build-love-tag-preview.mjs: PASS for both real products (latest staged build). Vite reported a large-bundle warning; mobile performance is not established. See build-preview.log and stage receipt.
- Runtime license collection/copy: installed SDK and production dependency notices added to both review packages. @better-auth/utils npm distribution has no notice; its original package metadata is retained as MISSING-NOTICE. **D02 is not complete; obtain/verify its upstream notice before release.**
- Actual browser: standalone Explorer normal ride launched at effective DOM520×1125; compact map/compass visible, touch buttons accessible. Settings → Customize touch controls → Hop size change → Save → reload retained82px Hop. No old4181 saved state changed. Portrait screenshot recorded. Requested landscape viewport did not change effective DOM size; landscape remains NOT RUN. Swoop offline Classic reached results earlier; full actual Explorer Tag round and two independent browser online rounds remain NOT RUN.
- No RTT/jitter shaping, eight-rider server profile, physical mobile/gamepad/VR test, Docker execution or hosted WSS verification performed.

## Evidence boundaries and blockers
- Local real-server component evidence is separate from browser and internet evidence. Matrix statuses in TEST_EVIDENCE.md deliberately retain NOT RUN where only a component passed.
- Hosted H01–H03 BLOCKED: no authorized hosted HTTPS/WSS endpoint, hosting credentials/permission or separate network/device verification. Server/client code and runbook exist; missing hosting is not used to omit them.
- Open local failures/gaps: Explorer bot lane exit/recovery; all route-edge coverage; Swoop meaningful cover/alternate routes; correct right-hand weapon mounting and Tag sound/mute feedback; Tag touch layout integration, gamepad edge/deadzone behavior; complete normal-mode restoration/resources/performance and error-case browser acceptance.
- Water/tree and startup fixes are source/headless verified only; requested location-specific visual tests remain unexecuted.

## Run / player flow
See DEPLOYMENT.md for exact local PowerShell commands. Build RideCore, start love-tag-server (8211), build the separate review packages, serve them on8212. Open the real product entry → LOVE TAG → Classic/Spread → Play offline or Create online room. A second player uses that product's invitation/code. Host starts/rematches; Back to game cleanly exits. Current old4181 and GitHub Pages are not this review build.

## Exact next runnable task
1. Rebuild/restart the service against the latest RideCore. Instrument the Explorer Classic bot's failing segment in node tests/map-ai.mjs; fix lane projection/turn clearance and add an assertion that bots never leave the permitted lane union without a documented recovery event. Re-run both actual fixtures.
2. Play full offline Classic/Spread and two independent actual browser clients on BOTH packaged entries; record steering/aim/fire, authoritative tag, complete result, reconnect/rematch/exit and screenshots. Run node tests/local-online.mjs again against the final source receipt.
3. Close remaining matrix gates, license notice and performance/input/restoration gaps before any authorized internet staging. Follow DEPLOYMENT.md only with explicit staging authorization.
4. The separate race request has a completed research brief. Its first runnable implementation task is a reliable end-to-end four-rider Arcade Race on the existing Dequindre Cut, then a dedicated adapter on actual Explorer lanes; do not conflate race AI with Tag AI.

## Subsequent focused Explorer blossom update

October 3 local scenery request: standalone Explorer and elmwood-source mirror now contain 23 enlarged blossoms (previously 9), with the crowded southern trees moved right into open lawns and new valley/creek/garden clearings. Added the Cherry blossom valley landmark viewpoint. Four placement/dressing tests, TypeScript check and separate Explorer review build passed. Two actual browser views were inspected and saved; see ../elmwood/BLOSSOM_PLACEMENT.md for commands, screenshots and release boundary. The source receipt was refreshed for the three changed Explorer files. Existing port4181/live packages were not promoted. This does not alter any LOVE TAG acceptance status or mark its release complete.

## Subsequent focused race map update

October 3 local race request: BOTH actual products now draw their own existing race course and numbered checkpoints on the mini-map and expanded map. Swoop uses the Cut-to-Mack course; standalone Explorer uses its real Creek Lane course. Gold next-gate guidance advances from the actual rules; passed gates turn gray and the final gate is marked F. Long-course framing was corrected after browser review. Ten focused tests, both TypeScript checks and both separate review builds passed. Actual browser evidence includes Explorer advancing through two gates, both games clearing the overlay on return to free ride, distinct full courses, and no captured console errors. See ../RACE_MAP_GUIDANCE.md and evidence/race-map-review.json for commands, changed-file hashes, screenshots, untested boundaries and the next runnable race task. Source revisions were refreshed. Only local port8212 review outputs were rebuilt; port4181 and hosted/live builds were not promoted. Existing LOVE TAG failures, hosted blockers and acceptance statuses remain unchanged.

## Subsequent focused creek grave thinning

October 3 scenery request: removed 143 of 159 estimated grave markers within 20m of open Bloody Run Creek, leaving 16 separated by at least 38.17m. Actual standalone Explorer placement data, mirror and separate local review asset match. Four scenery/placement tests passed, a real Rapier before/after check confirmed exactly 143 colliders removed, and the Explorer review package rebuilt. Two actual creek views were inspected, including the existing reduced-motion option; no captured console errors. See ../elmwood/CREEK_GRAVE_THINNING.md and its evidence receipt for exact records, hashes, commands, boundaries and restoration data.

To prevent invisible stones in TAG, the exporter now accepts an optional product argument; only Elmwood was regenerated. Its fixture revision is 20261003.2 (hash dab18d0638db3746073199e1ee8d3cde01d2a14ef80539e899fc94eb5cfdcc35), 103 lane edges, 40 anchors and 560 colliders. Server/client source, mirror and staged review fixtures match. The local service restarted on8211; two independent SDK sessions passed create/valid-code/lookup/join/leave compatibility with this hash. See evidence/creek-fixture-room-smoke.json. This does not supersede the old full-round evidence or establish hosted/LAN/browser multiplayer acceptance. Existing failures and exact next acceptance tasks remain open; run them against the new fixture. No port4181 or hosted/live output was promoted.
