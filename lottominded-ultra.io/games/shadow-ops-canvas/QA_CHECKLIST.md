# QA Checklist

## Boot

- Page loads from a static server with no build step.
- Loading screen reaches title after all image load/error callbacks.
- Title screen shows Start Run and Settings.
- No console errors on first load.

## Campaign Loop

- Start run from title.
- Level 1 intro card appears, then Neon Jungle Vault gameplay starts.
- Collect 3 Level 1 keys, open the gate, enter the boss chamber, and defeat Canopy Drone Queen.
- Level complete card transitions to Level 2.
- Level 2 intro card appears, then Golden Circuit Foundry gameplay starts with conveyors, moving platform, and laser hazards.
- Defeat Jackpot Forge Titan and transition to Level 3.
- Level 3 intro card appears, then Astral Vault Core gameplay starts with floating platforms and beam hazards.
- Defeat Midas Heartcore Overlord and trigger final victory/results.
- Replay from results.


## Underground Sectors

- Level 1 surface entrance opens Rootline Underworks.
- Level 2 surface entrance opens Furnace Service Depths.
- Level 3 surface entrance opens Astral Catacombs.
- `S`/Down/touch `DOWN` enters at the portal and does normal crouch elsewhere.
- Each underground sector has exactly three cell pickups.
- Returning through the exit after all three cells marks the sector complete.
- Boss gate stays locked with three keys until the underground sector is complete.
- Bosses, arena locks, extraction portal, and lottery terminal do not spawn/update underground.
- Debug buttons `UG Door`, `UG Enter`, `UG Cells`, `UG Clear`, and `Surface` smoke-test the new loop.
## Combat

- Player shots damage enemies and bosses.
- Boss HUD appears only during boss fights and shows boss name, phase, attack state, and health.
- Shield guard blocks frontal non-overdrive shots.
- Dash and overdrive grant short invulnerability.
- Dynamic boss hazards telegraph before damage.
- Checkpoints restore the player without resetting the whole campaign.

## Responsive/Input

- Desktop keyboard works.
- Pointer aim works when the cursor is active over the canvas.
- Touch controls work on a small viewport.
- Gamepad works when available.
- Pause on Escape/P and on browser focus loss in normal mode.
- Settings toggles persist across refresh.

## Visual

- Level 1, Level 2, and Level 3 look distinct at a glance.
- Generated Higgsfield backgrounds render locally with no hotlinks.
- Boss sprites are visible in their arenas.
- HUD stays legible and does not cover the center playfield.
- Objective chip is transient.
- No checkerboard artifacts appear in the live playfield.

## Browser QA Performed

- `node --check src/game.js`: passed.
- `node --check` against a temp copy of `src/game.js` after underground-sector changes: passed.
- Static debug URL `http://127.0.0.1:8150/games/shadow-ops-canvas/index.html?v=underground-levels-1&debug=1`: returned HTTP 200.
- In-app browser debug load showed the new UG Door/UG Enter/UG Cells/UG Clear/Surface controls and no active boot error.
- Keyboard start smoke test reached Level 1 HUD with `1 Neon Jungle SURFACE`.
- In-app browser load at `http://127.0.0.1:8150/games/shadow-ops-canvas/index.html?bg=soul-location-1&v=three-levels-bosses-1&debug=1`: passed.
- Title screen screenshot: passed.
- Start Level 1 screenshot: passed.
- Debug boss jump screenshot with Canopy Drone Queen: passed.
- Debug Level 1 -> Level 2 -> Level 3 transition screenshots: passed.
- Direct Level 3 final victory screenshot: passed.
- Console warnings/errors during QA: none observed.
- Encounter director debug wave screenshot: passed.
- Boss chamber and final results smoke test after encounter-director update: passed.
- Public non-debug title load after cache-bust update: passed.
- Higgsfield mission FX and cleaned-platform asset pass screenshots: passed.
- Debug Wave and Boss smoke screenshots after asset pass: passed.
- Console warnings/errors during asset-pass QA: none observed.

## Audit Regression Suite (September 6, 2026)

- Input edges are consumed once per simulation step, with keyboard and both controller slots checked at 30, 60, 120, and 144 Hz.
- Controller assignments survive sparse device indexes, disconnects, replacements, and reconnects. Active-controller loss pauses the run.
- Controller navigation reaches every settings checkbox and the difficulty selector; changes persist. Space still toggles a keyboard-focused checkbox.
- Pointer aiming reverses the vertical camera offset and the phone/tablet landscape lift.
- Portrait HUD meters retain usable width, objectives occupy their own row, and narrow-landscape pause controls stay within the viewport.
- Browser regression suite: 25 checks passed. Phone/tablet viewports: 390x844, 844x390, 768x1024, 1024x768, 320x568, 568x320. Reduced-motion mode and canvas pixels were checked.

Run from the game directory against a running HTTP preview:

```text
node tests/audit-regressions.cjs http://127.0.0.1:8151/games/shadow-ops-canvas/index.html
```

The suite requires Playwright and Chrome. It can reuse an existing Playwright installation through `PLAYWRIGHT_MODULE_PATH` or `NODE_PATH`. `PLAYWRIGHT_CHANNEL` selects another installed Chromium channel. `AUDIT_OUTPUT_DIR` selects a screenshot/results directory; the default is under the operating system's temporary directory. Test-only state hooks are injected into the isolated browser response, never into shipped source. No rewards, payments, or live deployment are exercised.

## Remaining Device Checks

- Full non-debug 10-15 minute campaign clear.
- Touch-only pass on a physical phone.
- Gamepad-only pass with a connected controller.
