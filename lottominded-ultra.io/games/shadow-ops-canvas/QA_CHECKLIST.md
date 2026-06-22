# QA Checklist

## Boot

- Page loads from a static server with no build step.
- Loading screen reaches title after all image load/error callbacks.
- Title screen shows Start Run and Settings.
- No console errors on first load.

## Core Loop

- Start run from title.
- Move left/right, jump, crouch, aim up/down, fire, dash, overdrive.
- Collect shards and health pickups.
- Collect 3 keys and verify gate opens.
- Enter boss chamber and verify boss health HUD appears.
- Defeat Vault Sentinel across phase changes.
- Reach extraction portal and view victory results.
- Lose all lives and view failed-run results.
- Replay from results.

## Combat

- Player shots damage enemies and boss.
- Shield guard blocks frontal non-overdrive shots.
- Enemy shots and contact damage hearts.
- Dash and overdrive grant short invulnerability.
- Combo increases on kills and expires after a short timer.
- Accuracy, kills, damage, score, max combo, and rank update on results.

## Responsive/Input

- Desktop keyboard works.
- Pointer aim works when the cursor is active over the canvas.
- Touch controls work on a small viewport.
- Gamepad works when available.
- Pause on Escape/P and on browser focus loss.
- Settings toggles persist across refresh.

## Visual

- HUD does not cover the center playfield.
- Boss HUD only appears during boss fight.
- Objective chip is transient.
- Soul Location backgrounds render and parallax.
- Player atlas is framed without clipping.
- Procedural enemies, boss, pickups, gate, portal, and projectiles are readable.

## Performance

- Fixed timestep remains stable at common desktop and mobile viewport sizes.
- Reduced Motion lowers particle count.
- No runaway entity growth after several minutes of play.
