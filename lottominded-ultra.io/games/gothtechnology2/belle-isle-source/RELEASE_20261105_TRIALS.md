# Sky Circuit and One-Wheel Island Cup

## Play

Choose **Sky Circuit** or **One-Wheel Island Cup** on the welcome screen, or open
**Menu → Sky Circuit & Island Cup** while exploring. Choose a course to move to
its start with the correct vehicle, then wait for the three-second countdown.

| Series | Course | Route length | Checkpoints |
| --- | --- | ---: | ---: |
| Sky Circuit | Bridge Skyline | About 1.44 km | 18 |
| Sky Circuit | Sunset Halo | About 966 m | 16 |
| One-Wheel Island Cup | Fountain Drive lap | About 330 m | 16 |

The wheel cup follows the mapped Fountain Drive road around Scott Fountain.
Bridge Skyline follows the bridge with a broad return over the river; Sunset
Halo is a high loop above the western island. These are game courses, and route
lengths are calculated from the authored game geometry.

The current gate and two upcoming gates appear in the scene. The course map is
framed around the selected route. The HUD shows elapsed time, gate count,
direction and distance to the next gate, and the course's personal best. Sky
also shows whether to climb or descend.

## Controls and timing

- Wheel: WASD or arrow keys to ride; Space to hop.
- Sky: W/S forward and reverse, A/D strafe, left/right arrows to turn, E/Q to
  ascend and descend, Space to brake, and Shift to boost. Touch uses the existing
  movement joystick with visible yaw, altitude and brake buttons.
- **R** or **Restart** returns directly to the same course start and begins a new
  countdown. It replaces recovery while a trial is active.
- **Leave race** returns to exploration at the current position.
- Menus, pause, hidden tabs and loss of window focus pause the run. The resume
  frame is re-anchored with movement held, so a paused interval cannot count
  toward a finish or sweep a gate.

Sky courses use drone flight for comparable records. Vehicle changes, landing
and flight-mode changes are locked during a run. Leaving restores the previous
flight-mode preference. Travel and other game modes cancel the current attempt.

Gates require a forward crossing through the opening in the correct order.
Sky checks height as well as horizontal position. Swept segment checks avoid
missing a gate between rendered frames; split and finish times are interpolated
at the crossing. The timer uses active wall time rather than a capped physics
step. A discontinuous move or wrong vehicle ends the attempt without a record.

## Personal bests

Each versioned course and vehicle has an independent browser-local record.
Finishing shows the time, comparison with the previous best, and checkpoint
splits. Slower runs retain the best time. Restarted and cancelled runs do not
write a result. If browser storage is unavailable, the game keeps the best for
the current visit and explains that it could not persist it.

## Validation

The source suite includes tests for forward 3D gate crossings, out-of-order
gates, fast crossings, altitude misses, timer pause/restart behavior,
sample-rate-independent finish interpolation, record isolation, and malformed
or unavailable storage. Course tests check collision and height clearance,
road placement, and completion of every gate using the normal wheel and drone
controllers. Airborne start placement has a separate controller regression.

The `Belle Isle time-trial review` pull-request workflow builds the real game
and exercises desktop with reduced motion, phone portrait, and short phone
landscape. It uses ordinary visible controls and trusted input, checks movement,
pause and restart, and captures screenshots for manual review. It does not
claim a full human-driven course finish or physical-device performance result.
The existing Pages workflow continues to validate the full source suite,
Dispatch/Photo Quest visuals, the storefront, and packaged arcade assets.

Production publication follows the repository's explicit approval rule.
