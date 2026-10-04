# MonoRace reference research and race implementation brief

Research date: October 3, 2026. Target: Swoop Detroit and the separately packaged Elmwood Explorer. This is a source-grounded design/engineering brief; the proposed race upgrade has not been implemented or deployed by this research.

## What the reference confirms

I used Google to locate the matching product and checked the developer's current Steam material directly. The reference is **MonoRace, Steam app 2860870, SIA BASE LOGIC**, released December 1, 2025.

The developer describes an arcade EUC racer with leaning-based movement, mouse control on PC, body leaning in VR, training, multiple paths/shortcuts, collectible benefits, tricks and competitive finishing. The current listing includes single-player, VR support, statistics and Steam leaderboards. [Current Steam listing](https://store.steampowered.com/app/2860870/MonoRace/).

The developer's launch announcement confirms rival riders competing for bonuses, alternate/hidden paths, tricks/flips, and winning races to unlock harder tracks. [Official launch announcement](https://steamcommunity.com/app/2860870/allnews/).

The older MonoRaceVR app 1722290 has 2023 announcements describing intended online features. That is a different listing/history; those announcements do not establish working multiplayer in the user's linked release. The current app's published feature list supports single-player; online races should be treated as our own additional requirement until independently verified in MonoRace.

Published material does not disclose exact acceleration curves, collision code, AI algorithms, item durations, checkpoint validation, leaderboard security, or the precise trick-scoring formula. I have not purchased or played MonoRace. Numbers and algorithms below are proposed for our existing games, not claimed MonoRace internals. Google also returns an unrelated 2010 mobile game and autonomous-drone research called MonoRace; these were excluded.

## Existing foundation verified in this workspace

- Swoop editable source: `C:/Users/digit/Documents/phone/_goth_swoop_release_20260916/lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/`.
- Real standalone Explorer source: `C:/Users/digit/Documents/phone/euc-detroit-riverwalk/src/detroit/`; packaging mirror: `.../gothtechnology2/elmwood-source/`.
- Shared RideCore: `C:/Users/digit/Documents/phone/Digital_Static_RideCore/`. Preserve Three.js 0.185.1, Rapier 0.20.0 and the established rider/vehicle assets.
- Swoop `raceRules.ts`: three-second countdown, ordered full-route gates, mapped Mack Avenue finish, four-rider position order, recovery anchors. `raceView.ts`: race HUD/results/retry and per-route/difficulty/vehicle/rider personal bests. `racePilot.ts`: physical controller, committed passes, obstacle/surface lookahead, curvature pacing and recovery. Source presence is not a new full-route gameplay pass.
- Swoop already contains a mapped detour in `CUT_THROUGH`; route branching needs explicit progress and rejoin validation, rather than assuming that data alone creates a complete shortcut feature.
- Explorer `elmwood-gameplay.ts`/`elmwood-ride.ts`: sprint countdown, swept checkpoint detection, split times against a saved reference, trick scoring, route tour, audio feedback, configurable touch controls, camera modes and retry. Its sprint is currently limited to 120 seconds and shares the lane-gate course; it needs its own multi-rider race adapter for the proposed race format.

## The race to build

Create a clearly labeled **Arcade Race** preset using the existing EUC engine and body animation. Keep ordinary exploration, bicycles, community rides, companions, LOVE TAG, audio preferences and saved controls intact. The same race handling profile must apply to human and AI racers; outfits remain cosmetic.

| Order | System | Required work and player benefit |
|---|---|---|
| 1 | Reliable starts and opponents | Check each grid slot plus its launch corridor against real terrain/props. Countdown freezes every racer equally; all launch on the same tick. Rivals follow curvature-aware racing lines, commit to passes, and retain room for recovery. This addresses the previously reported stationary/bunched riders before adding more speed. |
| 2 | Responsive arcade riding | Add an injected race profile for acceleration, braking, steering and modest short boosts. Keep lean/hip/knee animation continuous and the eye camera aligned with steering. Offer steering assistance and a calm camera; retain keyboard, gamepad and editable touch layouts. |
| 3 | Complete race presentation | Large 3–2–1–GO; compact position/lap or route progress, checkpoint arrow, next turn and time gap. Show a finish podium with time, clean tricks, medal, personal best, Retry and Change race. Keep important road space visible. |
| 4 | Multiple legitimate lines | Represent each course as a connected lane graph with common split/rejoin gates. Add a quicker technical line and an easier main line on verified surfaces. Validate progress on the chosen branch so a shortcut cannot skip the entire course. |
| 5 | Tricks and bonuses | Bank points on clean landings, show a readable combo, and reset the unbanked portion after a fall. Race-place medals and style awards remain separate, so beginners still earn useful feedback. Add a small set of clearly identified boost/score pickups with deterministic respawns and equal rules for AI. |
| 6 | Replayable progression | Start with short accessible events, then unlock longer/harder routes through completion/medals. Add personal-best ghosts, track-specific records and practice runs. Store new progression under a versioned race namespace; do not rewrite old best times or shared store-discount balances. |
| 7 | Private online racing | Extend the authoritative server with a separate race room/rules module: shared countdown, inputs, checkpoints, pickups, recoveries, finish ordering and results. Clients render/predict; the server validates results. This requires new race tests even though the LOVE TAG transport already works locally. |

### Initial event set

**Swoop:** a short Dequindre Cut introduction, a technical route with verified alternate lines, and the established Cut-to-Mack finish. Keep real landmarks and existing storefronts. Place reversible event barriers/ramps/flags on tested dry pavement; confirm every branch's joins, widths and clearances.

**Standalone Explorer:** a gentle lane race and a longer connected lane loop near the creek, using actual mapped junctions and permitted riding surfaces. Preserve the pond, memorials, planting and cemetery landmarks. Race routes and pickups remain on permitted lanes. A stunt session can remain its own mode where the existing geometry supports it.

Suggested first tuning experiment: 4 riders, a short event lasting roughly 60–120 seconds, an optional longer event, three skill presets, and a brief boost with a visible budget. Tune speeds and camera effects from measured stopping distance, turn radius, frame time and player feedback. These are prototype targets, not fixed specifications extracted from MonoRace.

## Engineering details that make the racing work

1. **Track graph and progress:** directed segments, width/surface/height, legal branches, common gates and distance-to-finish. A race cursor records branch and gate progress. Project onto plausible nearby segments; do not let a distant parallel road advance the rider. Finish requires the ordered course and the actual finish line.
2. **AI:** pure-pursuit steering with a speed-dependent lookahead, braking before bends using measured curvature, stable lane preferences, early obstacle avoidance and a bounded passing commitment. Pickups are goals only when reachable and worthwhile. A stuck racer brakes/backs up along a clear local maneuver before a visible checkpoint recovery with a penalty. Avoid invisible teleports, permanent queues or repeating side-to-side decisions.
3. **Race controller/animation:** inject tuning into each controller; preserve ordinary defaults. Smooth steering, race crouch/tuck, braking recovery, landing compression and arm balance. Trigger trick transitions from actual takeoff/landing events. Keep identical competitive contact volumes across character sizes.
4. **Pickup and trick authority:** use unique event IDs, cooldowns and swept collision. A pickup is awarded once. Validate airborne rotation and landed control before banking a trick. In online racing, only server-confirmed events award scores or boosts.
5. **Presentation/assets:** original race arch, numbered grid markers, checkpoint/turn flags, a restrained boost trail, pickup meshes/icons and finish/medal UI. Reuse present riders, wheels, textures and audio. Generated mockups are not evidence that the race works. Paid generation and a new engine are unnecessary prerequisites.
6. **Progress storage:** keys include game, track revision, vehicle category and handling version. Keep race medals/records distinct from offline practice and Tag. Online global leaderboards need validated submissions and a real service; a browser-local record should be labeled accordingly.
7. **Performance:** update nearby rival rigs fully and simplify distant ones; pool effects/pickups, reuse geometry and avoid per-frame DOM rebuilds. Measure an eight-rider room, mobile portrait/landscape layouts and actual supported hardware before promising performance.

## Implementation sequence and gates

The AI recommendation is grounded in established path following, obstacle avoidance and group separation/alignment techniques described by [Craig Reynolds](https://www.red3d.com/cwr/steer/). These are techniques for our implementation, not evidence of MonoRace's internal code.

For collision repair, [Rapier's controller guide](https://rapier.rs/docs/user_guides/javascript/character_controller/) documents shape/ray casts, movement correction, collision margins and slope/ground handling. It also states that its generic character controller handles translation rather than rotation. Keep RideCore's EUC steering/lean model; inspect collision margins and swept clearance instead of replacing it with a generic walking controller. The current online guide is for Rapier0.21; verify each API against our installed0.20.0 before use. No physics upgrade is required by this brief.

1. Capture current race baselines separately for both packaged entries. Log racer motion immediately after GO, every checkpoint, obstruction/recovery, finish and exit.
2. Deliver one end-to-end four-rider race per product: verified grid, reliable physical AI, compact HUD, timing/results and immediate retry. Run repeated complete courses before adding branches or bonuses.
3. Add one real alternate route, then trick banking and limited pickups. Test shared rejoin gates, skipped/reversed checkpoints, simultaneous pickup collection and recoveries.
4. Add medals, unlocks and local personal-best ghosts with versioned persistence and failure handling.
5. Add private authoritative online race rooms and test independent human input, full results, reconnect, rematch and version rejection in both real games. Hosted verification remains a separate authorized deployment gate.

Required regression cases: no stalled launch, legal rival routes, no bunching deadlock, missed-gate recovery, branch shortcuts, checkpoint tunneling, reverse travel, duplicate pickups, crash/combo reset, tied finishes, online clock consistency, normal-mode exit, muted/reduced-motion settings and touch-layout persistence. Capture WebGL screenshots and median/p95 frame times. Target 60 fps on the selected desktop and stable 30 fps on a named tested mobile device; hardware not used stays untested.

## Immediate next race task

Implement and play through the first four-rider Arcade Race on the existing Dequindre Cut course, starting with launch-corridor and full-route AI telemetry. Then port the same race rules through a dedicated adapter to the actual Explorer lane course. Keep progress/AI/collision fixes ahead of cosmetic additions. Current LOVE TAG AI still has an open Elmwood navigation/recovery failure, recorded separately in `love-tag/STATUS.md`; the two modes must not be conflated.
