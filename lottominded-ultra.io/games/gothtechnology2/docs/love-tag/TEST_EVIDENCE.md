# LOVE TAG — dual-game acceptance matrix

Updated October 4, 2026. PASS below may refer to the named shared deterministic component; browser/network scope is stated explicitly in the evidence notes. Unexecuted complete player flows remain NOT RUN. Current identity: evidence/multiplayer-release-revisions-20261004.json. The user approved current browser access: two actual clients per product completed Classic rounds/rematches on the full-map fixtures. See evidence/browser-two-human-polish-20261004.json. Complete-map traversal and hosted internet are not verified.

Use statuses: PASS, FAIL, BLOCKED, NOT RUN, or NOT IN SELECTED PHASE. An unavailable external Explorer project is BLOCKED, not a substitute Swoop-map pass. A game can pass local network tests while hosted internet tests remain NOT RUN.

## Environment record

Record date, source root and revision for both games, server revision, controller and physics versions, map/arena/rules hashes, active/spectator counts, human/bot counts, operating system, browser version, viewport, input device, renderer quality, server machine, and actual network shaping.

For every test retain: setup, actions, expected behavior, actual behavior, result, command/log/screenshot location, and open issue reference. Do not use generated mockups as browser screenshots.

| ID | Scenario and required behavior | Swoop | Elmwood |
|---|---|---|---|
| D01 | Real editable source and packaged entry resolved; no minified-output-only integration | PASS | PASS |
| D02 | External assets/shared dependencies/license checks complete before packaging changes output | PASS | PASS |
| D03 | Existing normal riding, challenges, controls, sound, and saves have a recorded baseline | NOT RUN | NOT RUN |
| O01 | Offline Classic completes a match with one human plus at least one bot; no server required | PASS | PASS |
| O02 | Offline Spread completes with one human plus at least three bots | PASS | PASS |
| O03 | Classic always has exactly one It, including after recovery or transitions | PASS | PASS |
| O04 | Spread catches convert once; last-catch/timer boundary resolves deterministically | NOT RUN | NOT RUN |
| O05 | Tag/transition locks prevent immediate back-tag; stale role-epoch projectiles expire | PASS | PASS |
| W01 | Heart and moving rider cross between steps: continuous collision detects valid hit | PASS | PASS |
| W02 | Cover hit occurs before rider: no tag through wall, floor, vegetation collider, or elevation separation | NOT RUN | NOT RUN |
| W03 | Third-person camera outside cover cannot create a shot through an obstructed muzzle | NOT RUN | NOT RUN |
| W04 | Duplicate input/event/projectile IDs never award duplicate shots or tags | PASS | PASS |
| W05 | Range, lifetime, charges, and regeneration are enforced at boundary ticks | NOT RUN | NOT RUN |
| W06 | Different rider costumes retain the same competitive tag volume and handling | NOT RUN | NOT RUN |
| P01 | Tag settings are injected; Free Ride and other modes keep original tuning | PASS | PASS |
| P02 | Hop buffering/release, burst budget/cooldown, landing, and recovery obey state restrictions | NOT RUN | NOT RUN |
| P03 | Snapshot/restore and identical input replay restore relevant internal controller state | PASS | PASS |
| P04 | Manual reset/out-of-bounds is not a safe escape, invulnerability loop, or ammo refill | PASS | PASS |
| A01 | Bots navigate all permitted route edges and avoid map restrictions | NOT RUN | NOT RUN |
| A02 | Bot loses sight: finite last-known memory and fair search, no omniscient pursuit | NOT RUN | NOT RUN |
| A03 | Bot difficulty affects reaction/decision/aim but not hidden speed/ammo | NOT RUN | NOT RUN |
| N01 | Two independent human clients create/join one actual server room | PASS | PASS |
| N02 | Each client independently steers/aims/fires and sees the other's authoritative state | PASS | PASS |
| N03 | Classic online round completes with identical authoritative roles/results on clients | PASS | PASS |
| N04 | Spread online round completes with identical authoritative roles/results on clients | PASS | PASS |
| N05 | Humans-only match and mixed human/server-bot match both work; bot seats clearly labeled | PASS | PASS |
| N06 | Capacity includes bots; no ninth active participant; spectators have a separate limit | NOT RUN | NOT RUN |
| N07 | Invite code/link follows the correct real entry, nested path, map, and arena | PASS | PASS |
| N08 | Expired/full/wrong-map/incompatible-version requests return accurate actionable errors | NOT RUN | NOT RUN |
| N09 | 5-second outage and rejoin keep one seat, current role, score, and ammunition | PASS | PASS |
| N10 | Reconnect expiration/explicit leave applies DNF/seat policy; no unreachable ghost runner | NOT RUN | NOT RUN |
| N11 | Host leaves but dedicated match continues; lobby authority transfers safely | NOT RUN | NOT RUN |
| N12 | Online menu/focus loss releases input without freezing others or granting immunity | NOT RUN | NOT RUN |
| N13 | Spoofed identity, another room's command, stale round, invalid numbers, and excessive fire rejected | NOT RUN | NOT RUN |
| N14 | Measured latency/jitter tests retain consistency; correction behavior documented | NOT RUN | NOT RUN |
| N15 | Server shutdown/backend unavailable gives honest state; offline requires explicit selection | NOT RUN | NOT RUN |
| N16 | Local predicted heart rejected by server never creates a confirmed tag sound/score | NOT RUN | NOT RUN |
| U01 | Concurrent keyboard/mouse steer+aim+fire with safe UI focus/pointer-lock behavior | NOT RUN | NOT RUN |
| U02 | Gamepad binds tested or explicitly untested; no permanent binding overwrite | NOT RUN | NOT RUN |
| U03 | Portrait/landscape touch controls operate concurrently and do not hide hazards | NOT RUN | NOT RUN |
| U04 | Existing touch layout editing and saved settings preserved where supported | NOT RUN | NOT RUN |
| U05 | Role is readable without color/audio; reduced motion and mute settings respected | NOT RUN | NOT RUN |
| R01 | Exit/restart/rematch releases sockets, handlers, timers, effects, and temporary geometry | NOT RUN | NOT RUN |
| R02 | Repeated cycles keep stable resource counts; no second simulation/render loop | NOT RUN | NOT RUN |
| R03 | Existing bicycles/community rides/companions/score bridges are preserved and isolated | NOT RUN | NOT RUN |
| R04 | Correct packaged assets, collision data, and external texture paths work | NOT RUN | NOT RUN |
| R05 | Desktop/mobile frame metrics and eight-rider server timing recorded, not assumed | NOT RUN | NOT RUN |
| H01 | Hosted HTTPS client connects through valid WSS transport/auth path | BLOCKED | BLOCKED |
| H02 | Separate devices on separate networks complete a hosted round and rematch | BLOCKED | BLOCKED |
| H03 | Hosted reconnect, map/version rejection, rate limits, and unavailable-service behavior checked | BLOCKED | BLOCKED |
| H04 | Production/staging config and secrets separation verified; rollback documented | NOT RUN | NOT RUN |

## Required evidence sets

Final packaged browser supplement: both game directories were copied from the complete 1016.7 MiB Pages assembly into the approved 8212 review (local server URL only). Swoop 844 x 390 landscape and Explorer 369 x 844 portrait have no horizontal overflow; shared Tag touch buttons and map have non-overlapping rectangles. Explorer chat sits above the pads. My display 50% changes the actual buffer/pixel ratio and was restored. After the authoritative server was stopped, both browsers ran offline Classic with three moving bots and UI-driven Cruise moved the humans. See `evidence/browser-final-package-phone-offline-20261004.json`, `browser-offline-moving-20261004.json`, `swoop-tag-landscape-polish-20261004.png`, and `elmwood-tag-phone-polish-20261004.png`. This supplements O01/R04 component evidence but does not complete simultaneous physical multi-touch U03, every-map-collider R04, controlled frame metrics R05, or full-round offline browser acceptance. Hosted/LAN evidence remains absent. Browser access is no longer blocked.

Offline browser result follow-up: both actual Classic sessions subsequently reached results at tick 11160 and returned to their normal menus (`evidence/browser-offline-results-20261004.json`). O01 now has full-round browser evidence with the local server unavailable, plus the prior deterministic tests. These humans made no tag in the offline samples; the earlier two-human online rematches recorded tags. Swoop portrait 390 x 844 also has no horizontal overflow. The discovered shadow deprecation is fixed in source and rebuilt; the final source/package revision receipt supersedes the first reviewed module hashes.

### Deterministic/headless tests

Include classic role invariants, ordered simultaneous impacts, final-tick ordering, command replay/dedup, charge and burst boundary checks, collision obstruction/vertical separation, full controller snapshot/restore, seeded bot perception, and recovery/forfeit policy. Use assertions against state transitions, not only rendered labels.

### Local online test

Launch the actual authoritative service and actual clients with separate browser contexts or devices. Record server room IDs, connected human count, each player's independent input, a server-confirmed tag, a finished round, and a reconnect. Repeat for both games and both rulesets. Two browser windows with a local fake transport do not qualify.

### Network conditions

Record actual RTT/jitter configurations; suggested cases are 0, 80, 150, and 250 ms RTT, plus jitter and a five-second outage. Use a supported proxy or network emulator; a browser request-delay shim alone may not affect an established WebSocket. Measure what the tool really changes. Report median/p95 correction distance, input acknowledgement delay, and room tick time; set thresholds after the measured baseline.

### Visual evidence

For each product capture lobby, active runner, active tagger, confirmed tag/role transition, round result, offline state, network failure, and a mobile view. Include exact build/viewport. Inspect the WebGL pixels for clipping, invisible hearts, hand/weapon placement, UI overlap, and camera-through-cover artifacts.

### Hosted internet test

Use an authorized deployed HTTPS client and WSS-capable service with separate device/network connections. A server build or localhost network pass is not this test. If deployment credentials, permission, or a second network/device is unavailable, mark the corresponding evidence NOT RUN or BLOCKED and explain the remaining procedure.

## Exit status template

```text
Target / ruleset:
Source + server revisions:
Implemented:
Unit/headless tested:
Packaged browser tested:
Local real-server multiplayer tested:
Hosted internet tested:
Devices actually used:
Open failures / untested combinations:
Exact next action:
```

## Historical evidence before the full-map and multiplayer-control increment

The notes below are retained as history. They do not establish browser acceptance of the current full maps or chat/controls. Updated evidence follows.

## Executed evidence and scope qualifications

- D01: both real editable runtimes, separate packaged entries and shared Core resolved. The packaging builder uses actual Explorer, not Swoop's internal Elmwood map.
- O01/O02 PASS: actual offline Classic and Spread completed in EACH game with one independently controlled local human and three local bots, no server room. Human steering/aim/heart input was exercised in Classic. A separate offline rematch cleared prior results; exit restored normal menus. See evidence/offline-browser-20261004.json. Navigation defects remain A01 failures; completing a round is not an all-route AI pass.
- O03/O05/W01/W04/P01/P03/P04: shared deterministic assertions passed in core-actions-final.log (11 tests), including preserved mode tuning, role invariant, continuous collision, dedup, controller replay and penalties. New batched commands retain reset/hop/burst until one server simulation step. Costume/map variants not directly covered remain NOT RUN. W02 has muzzle-wall component coverage, not every authored cover case. O04 has a final-catch component case, but exact final timer ordering permutations are not complete. W05/P02 have partial boundary coverage, not all states.
- N01/N02 PASS: TWO actual independently controlled browser clients in each product created/joined the real Colyseus room. Distinct sessions steered in different directions, aimed and fired; authority recorded both human shot events. See actionFixA/actionFixB for Swoop and actionFix/actionFixA for actual Explorer, plus original Classic receipts in evidence/two-browser-20261004.json. This is not split screen or bots standing in for humans.
- N03/N04 PASS: each actual two-browser Classic and Spread round reached matching server results on both clients. Swoop Spread ended with all caught; Explorer Spread ended at its timer. Each had its own actual arena/hash. The four independent real SDK scenarios also passed after the server latch fix in local-online-actions-final.log / evidence/local-online.json.
- N05 PASS: humans-only Classic and mixed two-human/two-server-bot Spread worked in both products; HUMAN/BOT labels were visible. These passes do not test capacity/spectator/8-player limits.
- N07 PASS: real copied invitation links were followed to each correct nested packaged entry, map/product/version/arena. Explorer remained the separately packaged game. Both invitation clients showed Spread correctly.
- N09 PASS: actual five-second SDK socket interruption/reconnect was invoked via the opt-in tagReview=1 review control in each product. The other client continued; the same seat, round, roles/score/ammo were retained, and the proxy stayed taggable. A manual refresh after grace correctly expired in one earlier attempt; a complete within-grace reload matrix is NOT RUN.
- N08/N10/N11/N12/N13/N15: partially implemented or sampled evidence does not cover each listed combination, so complete rows stay NOT RUN. Explicit browser leave showed DNF in an Explorer round and normal menus restored, but full seat/host transfer/error/security policy coverage is incomplete. Online menu input release is implemented, not a full concurrent focus-loss acceptance test.
- A01 FAIL: Swoop sampled bots travel 663–702m without illegal ticks/recoveries in the retained actual-fixture test, but not all allowed edges are covered. Explorer Classic bot had 360 illegal ticks/two recoveries. Browser offline bots also recover. Tag navigation differs from the successful normal-race pack. See actual-map-ai-final.log / evidence/actual-map-ai.json; failed tuning attempts were reverted.
- U03 partial: effective DOM 390x844 portrait and 844x390 landscape inspected in both normal races and Tag. Readable race/map separation, no primary control overlaps, 44px minimum menu/restart targets and saved Explorer 82px Hop recorded. Real simultaneous thumbs/hazard visibility while driving, hardware latency and performance remain NOT RUN. Screenshots are padded by the backend; use effective dimensions in evidence/water-phone-browser-20261004.json.
- U04 partial: Explorer's existing editor saved/reloaded Hop 80→82px in the prior review. New fitting keeps stored positions/sizes/actions intact and tests overlap resolution. Full Tag/duo editor/device combinations are not accepted; row remains NOT RUN.
- U05 partial: role text is visible without color/audio. Existing mute settings were preserved; complete audio, weapon-hand and accessibility acceptance is NOT RUN.
- R01 partial: actual browser exit restored normal menus and cleared Tag state; actual new rematches worked in both games. Repeated handler/socket/timer/geometry counts and pending-interruption exit stability are not fully profiled, so resource acceptance stays NOT RUN.
- D02 BLOCKED: runtime notices copied but installed @better-auth/utils has no notice. Upstream notice/provenance needed before release.
- H01–H03 BLOCKED: no authorized hosted HTTPS/WSS endpoint/credentials and no separate-network devices. Server/client code and deployment runbook exist; no hosted test or deployment occurred. H04 runbook prepared; Docker/proxy/rollback execution NOT RUN.
- All other NOT RUN rows retain the full-scenario requirement. Source implementation, component tests or unrelated normal-race tests do not make them pass.

## Evidence identity and boundary

Windows, Node 24.16.0, shared RideCore 1.2.0 / Three 0.185.1 / Rapier 0.20.0. Actual service http://127.0.0.1:8211; separate review packages on 8212. Browser Codex IAB/Chromium; effective dimensions in receipts, exact browser version and physical device model not captured. Two human browser sessions; Classic zero bots, Spread two server bots. Offline one human/three bots. No network shaping, separate-host LAN or hosted internet verification. No guest reconnect tokens/secrets recorded. Current individual source and canonical package hashes: evidence/race-water-revisions-20261004.json; arena identities in evidence/local-online.json. See ../RACE_WATER_POLISH.md for independent normal-race/controller/water evidence and limitations.
## Current full-map and multiplayer evidence, October 4

- D02 PASS: both actual products preflighted/built, model external resources validated, complete runtime notices copied. @better-auth/utils 0.3.1 declares MIT; original repository notice and explicit provenance included. Both gzip decoders restore the canonical full-map hashes.
- A01 NOT RUN for exhaustive allowed-edge coverage. The earlier Explorer illegal-bot failure was fixed: latest normal and Expert canonical simulations of both maps/rules have zero illegal bot ticks and zero resets. Logs: full-map-ai-commitment-final-20261004.log and tag-expert-full-map-20261004.log. Sampled coverage does not mean every edge was exercised.
- N01–N05/N09 PASS in current loopback SDK scope: full-map-online-v3-final-20261004.log, both rules/products, two independently controlled real-service clients, actual tags, reconnection, canonical results/rematch/exit. Older browser receipts remain historical. No current LAN/hosted claim.
- N07/U03 BLOCKED: automatic review rejected access/reopening of the local review browser page. No substitute browser or headless route was used. Current controls and 390x844/844x390 layout selection are component-tested; appearance, simultaneous fingers, performance and a full human course remain unverified.
- Chat: multiplayer-chat-20261004.log passes both actual products with two real SDK humans, server identity, room isolation, 160-character limit and per-user rate limiting. swoop-realtime-chat-20261004.log passes two independent existing public SDK clients in a random QA-only channel. UI uses text nodes, local mute and no saved chat. This does not establish browser moderation, physical-device or hosted Tag acceptance.
- Swoop split controls/view preference: 22 passing tests in multiplayer-controls-20261004.log. Online defaults to the owned camera; settings opt into split. Guest slot reads input 0; remote/bot panes do not control another seat. Each device stores its own resolution/FPS.
- Swoop Expert online-fill controller integration: online-race-fill-20261004.log, three distinct AI EUC rivals each finish all 12 gates while the stopped human stays unfinished. Real network race flow with AI remains NOT RUN.
- Actual Explorer Expert local races: elmwood-expert-race-20261004.log, 8 passing full-course/pack assertions. It has dedicated online LOVE TAG; a normal online-race transport in standalone Explorer is not implemented.
- Both actual product typechecks and paired release packages PASS. Portable Core and server install/build PASS after stopping a process that held a native module file open. Earlier failed install/typecheck logs are retained and superseded by their named final logs.
- H01–H03 remain BLOCKED: production config has no authorized hosted HTTPS/WSS service. GitHub Pages release does not host a persistent authoritative server.

## October 4 polish increment

Both source typechecks and real/portable Core builds PASS. Geometry checks PASS 14 (global-surface-joins-index-final-20261004.log). NVIDIA OptiX used actual RTX 3080 for two original lighting bakes (nvidia-lighting-report-20261004.json). CPU geometry count improved while construction cost increased in the measured sample; no GPU/game frame-rate assertion. Paired build and final indexed Swoop build PASS. New menu, Tag streaming/light/LOD and all-phone appearance checks remain BLOCKED pending explicit browser-access approval; physical hardware remains NOT RUN. Hosted endpoint remains BLOCKED.
