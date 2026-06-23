# LottoMind Vault Run

A static HTML5 Canvas run-and-gun game inspired by classic side-scrolling arcade structure, using original LottoMind art direction and local generated assets. The player collects three vault keys, opens the gate, fights the Vault Sentinel, and escapes through the extraction portal.

## Play Loop

1. Start a run from the title screen.
2. Move, jump, crouch, aim, dash, and fire heart rounds through the jungle vault.
3. Collect shards for score and overdrive charge.
4. Find all 3 vault keys to open the gate.
5. Enter the chamber, defeat the multi-phase Vault Sentinel, then reach the portal.
6. Review score, time, kills, accuracy, damage taken, max combo, rank, best score, and fastest clear.

## Controls

- Move: `A/D` or arrow keys
- Jump: `Space`
- Aim: `W/S` or up/down arrows
- Fire: `J` or `Z`
- Dash: `K`, `X`, or Shift
- Overdrive: `L` or `O`
- Pause: `P` or Escape
- Start/confirm: Enter

Gamepad and touch controls are supported. Touch controls can be hidden in Settings.

## Local Run

Serve the parent website folder and open:

`http://127.0.0.1:8150/games/shadow-ops-canvas/index.html?bg=soul-location-1`

The game has no bundler, backend, or external runtime requirement.

## Files

- `index.html`: semantic game shell, overlays, HUD, touch controls
- `style.css`: responsive game UI styling
- `src/game.js`: fixed-timestep simulation, input, progression, rendering, audio, saves
- `assets/`: local generated hero, mascot, and Soul Location background images
- `docs/`: earlier concept and generated-asset metadata
- `ASSET_MANIFEST.md`: active runtime asset inventory
- `ASSET_PROMPTS.md`: prompts for future sprite/background generation
- `QA_CHECKLIST.md`: manual and browser QA checklist

## Save Data

Best score, fastest victory clear, and settings are stored in `localStorage` under versioned LottoMind keys.
