# LOVE TAG — dual-game acceptance matrix

Updated October 3, 2026. PASS below may refer to the named shared deterministic component; browser/network scope is stated explicitly in the evidence notes. Unexecuted complete player flows remain NOT RUN. See STATUS.md and evidence/source-revisions.json.

Use statuses: PASS, FAIL, BLOCKED, NOT RUN, or NOT IN SELECTED PHASE. An unavailable external Explorer project is BLOCKED, not a substitute Swoop-map pass. A game can pass local network tests while hosted internet tests remain NOT RUN.

## Environment record

Record date, source root and revision for both games, server revision, controller and physics versions, map/arena/rules hashes, active/spectator counts, human/bot counts, operating system, browser version, viewport, input device, renderer quality, server machine, and actual network shaping.

For every test retain: setup, actions, expected behavior, actual behavior, result, command/log/screenshot location, and open issue reference. Do not use generated mockups as browser screenshots.

| ID | Scenario and required behavior | Swoop | Elmwood |
|---|---|---|---|
| D01 | Real editable source and packaged entry resolved; no minified-output-only integration | PASS | PASS |
| D02 | External assets/shared dependencies/license checks complete before packaging changes output | BLOCKED | BLOCKED |
| D03 | Existing normal riding, challenges, controls, sound, and saves have a recorded baseline | NOT RUN | NOT RUN |
| O01 | Offline Classic completes a match with one human plus at least one bot; no server required | NOT RUN | NOT RUN |
| O02 | Offline Spread completes with one human plus at least three bots | NOT RUN | NOT RUN |
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
| A01 | Bots navigate all permitted route edges and avoid map restrictions | FAIL | FAIL |
| A02 | Bot loses sight: finite last-known memory and fair search, no omniscient pursuit | NOT RUN | NOT RUN |
| A03 | Bot difficulty affects reaction/decision/aim but not hidden speed/ammo | NOT RUN | NOT RUN |
| N01 | Two independent human clients create/join one actual server room | NOT RUN | NOT RUN |
| N02 | Each client independently steers/aims/fires and sees the other's authoritative state | NOT RUN | NOT RUN |
| N03 | Classic online round completes with identical authoritative roles/results on clients | NOT RUN | NOT RUN |
| N04 | Spread online round completes with identical authoritative roles/results on clients | NOT RUN | NOT RUN |
| N05 | Humans-only match and mixed human/server-bot match both work; bot seats clearly labeled | NOT RUN | NOT RUN |
| N06 | Capacity includes bots; no ninth active participant; spectators have a separate limit | NOT RUN | NOT RUN |
| N07 | Invite code/link follows the correct real entry, nested path, map, and arena | NOT RUN | NOT RUN |
| N08 | Expired/full/wrong-map/incompatible-version requests return accurate actionable errors | NOT RUN | NOT RUN |
| N09 | 5-second outage and rejoin keep one seat, current role, score, and ammunition | NOT RUN | NOT RUN |
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

## Executed evidence and scope qualifications

- D01: actual editable source, separate built entries and shared Core identified; no internal-map substitution. See STATUS.
- O03/O05/W01/W04/P01/P03/P04: shared rules/controller deterministic assertions passed in core-tests.log (10 total). These results apply to both products using this Core; full costume/map/browser variants remain NOT RUN. W02 has a muzzle-wall component pass, but all authored vegetation/floor cover cases have not run. O04 has a final-catch component pass, but exact timer-boundary combinations are untested. W05/P02 have partial resource/headstart assertions; full boundaries are untested.
- D02 BLOCKED: runtime notices were copied, but @better-auth/utils has no installed npm notice. Metadata retained; upstream notice/provenance audit still needed.
- A01 FAIL: initial map simulation had many recoveries; latest Swoop sample has zero illegal ticks but not every route edge/alternate-cover gate is verified. Explorer Classic has one bot with360 illegal ticks/two recoveries. Metrics test completion is not a gate pass. See evidence/actual-map-ai.json and retained failed-first-pass data.
- N01–N05/N09/rematch: four real Colyseus SDK-client scenarios passed (each product and ruleset), including independent movement, confirmed tag, result equality, five-second reconnect and new round. See evidence/local-online.json. These are actual local-network component passes; complete two-browser player acceptance in this matrix remains NOT RUN. Latest AI tuning postdates that network run.
- U04: normal standalone Explorer touch editor opened; Hop changed80→82px, saved and retained after reload on review8212. Full Tag editor integration remains NOT RUN. U03 landscape override did not change effective520×1125 DOM viewport, so landscape remains NOT RUN. Portrait normal-HUD screenshot: C:/Users/digit/.codex/visualizations/2026/09/05/01a073f6-892e-70c1-a9a8-7659bc278528/elmwood-hud-portrait-20261003.png.
- O01: Swoop offline Classic reached results with one human/three bots in a browser, but independent human driving/aim verification and full acceptance are incomplete. Explorer browser offline completion NOT RUN.
- H01–H03 BLOCKED: authorized endpoint/credentials/second network unavailable; no hosted internet test or deployment. H04: Docker/proxy/runbook prepared, not executed.
- All other NOT RUN rows remain unexecuted; source implementation alone does not mark them passed.

## Current local evidence identity

Actual SDK endpoint http://127.0.0.1:8211, Windows/Node24.16.0, two human SDK sessions; Classic0bots, Spread2bots. Review browser is Codex IAB/Chromium at8212; exact browser version, named physical mobile and GPU performance not captured. Network shaping: none, localhost only. Guest reconnect tokens were not recorded. Source-revision receipt and arena hashes accompany the logs.
