# ROBOT RAHBE: UNDERGROUND

An exploration platformer with the original RAHBE hero, GM Renaissance Center cover, Detroit artwork, and seven fictional underground depths.

Play with keyboard, gamepad, or touch. On mobile, the left stick moves and climbs, the right stick aims, and either fire button shoots. Jump, use, crouch, sprint, and pause have separate buttons. Open the sliders button to save a two-, three-, or four-finger layout, choose handedness, reposition buttons, and change size, opacity, or stick mode.

Keyboard: A/D move, W/S climb, Space jump, J fire, E use, Shift sprint, C crouch, M map, Escape pause. The field guide explains ropes, mine carts, hazards, checkpoints, seals, and the final gate. Audio requires an explicit click.

`npm run check` checks the runtime modules. `npm test` runs 14 mechanics regressions and a continuous normal-damage route across every depth. `npm run test:browser` checks actual simultaneous Chrome touch input in portrait and landscape, layout persistence, release/rotation cleanup, and a rendered full route. Browser tests use the sibling GothTechnology Playwright dependency and a local server on port 4198.

Release validation on 2026-10-10: all seven depths visited; seals 03, 13, and 31 collected; all ten enemies and the Warden defeated; zero deaths; no teleports, invulnerability, or enemy edits. The rendered browser route also passed. Touch tests cover phone emulation; physical phone testing remains separate.

Real Detroit surface anchors surround fictional vaults. Arcade relics have no cash value, wagering, prediction, prizes, or redemption. Artwork and motion sheets were created for this project; Phaser and Lucide notices are included beside their runtime files.
