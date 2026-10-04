# LOVE TAG — dual-game acceptance matrix

This is an unexecuted test specification. All initial entries are **NOT RUN**. Fill in evidence only after executing the relevant build/test. Copy the matrix into the implementation's `docs/love-tag/TEST_EVIDENCE.md` and keep source revisions attached.

Use statuses: PASS, FAIL, BLOCKED, NOT RUN, or NOT IN SELECTED PHASE. An unavailable external Explorer project is BLOCKED, not a substitute Swoop-map pass. A game can pass local network tests while hosted internet tests remain NOT RUN.

## Environment record

Record date, source root and revision for both games, server revision, controller and physics versions, map/arena/rules hashes, active/spectator counts, human/bot counts, operating system, browser version, viewport, input device, renderer quality, server machine, and actual network shaping.

For every test retain: setup, actions, expected behavior, actual behavior, result, command/log/screenshot location, and open issue reference. Do not use generated mockups as browser screenshots.

| ID | Scenario and required behavior | Swoop | Elmwood |
|---|---|---|---|
| D01 | Real editable source and packaged entry resolved; no minified-output-only integration | NOT RUN | NOT RUN |
| D02 | External assets/shared dependencies/license checks complete before packaging changes output | NOT RUN | NOT RUN |
| D03 | Existing normal riding, challenges, controls, sound, and saves have a recorded baseline | NOT RUN | NOT RUN |
| O01 | Offline Classic completes a match with one human plus at least one bot; no server required | NOT RUN | NOT RUN |
| O02 | Offline Spread completes with one human plus at least three bots | NOT RUN | NOT RUN |
| O03 | Classic always has exactly one It, including after recovery or transitions | NOT RUN | NOT RUN |
| O04 | Spread catches convert once; last-catch/timer boundary resolves deterministically | NOT RUN | NOT RUN |
| O05 | Tag/transition locks prevent immediate back-tag; stale role-epoch projectiles expire | NOT RUN | NOT RUN |
| W01 | Heart and moving rider cross between steps: continuous collision detects valid hit | NOT RUN | NOT RUN |
| W02 | Cover hit occurs before rider: no tag through wall, floor, vegetation collider, or elevation separation | NOT RUN | NOT RUN |
| W03 | Third-person camera outside cover cannot create a shot through an obstructed muzzle | NOT RUN | NOT RUN |
| W04 | Duplicate input/event/projectile IDs never award duplicate shots or tags | NOT RUN | NOT RUN |
| W05 | Range, lifetime, charges, and regeneration are enforced at boundary ticks | NOT RUN | NOT RUN |
| W06 | Different rider costumes retain the same competitive tag volume and handling | NOT RUN | NOT RUN |
| P01 | Tag settings are injected; Free Ride and other modes keep original tuning | NOT RUN | NOT RUN |
| P02 | Hop buffering/release, burst budget/cooldown, landing, and recovery obey state restrictions | NOT RUN | NOT RUN |
| P03 | Snapshot/restore and identical input replay restore relevant internal controller state | NOT RUN | NOT RUN |
| P04 | Manual reset/out-of-bounds is not a safe escape, invulnerability loop, or ammo refill | NOT RUN | NOT RUN |
| A01 | Bots navigate all permitted route edges and avoid map restrictions | NOT RUN | NOT RUN |
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
| H01 | Hosted HTTPS client connects through valid WSS transport/auth path | NOT RUN | NOT RUN |
| H02 | Separate devices on separate networks complete a hosted round and rematch | NOT RUN | NOT RUN |
| H03 | Hosted reconnect, map/version rejection, rate limits, and unavailable-service behavior checked | NOT RUN | NOT RUN |
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
