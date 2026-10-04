# Race map guidance — October 3, 2026

Implemented in Swoop Detroit and the actual separately packaged Elmwood Explorer. Local review only; not committed, pushed, deployed, or promoted into the original storefront arcade packages.

## Player behavior

- Swoop: the current 12-gate Dequindre Cut course, from the entrance to Mack Avenue. The displayed route retains the mapped Cut bends and uses the race rules' exact gate positions.
- Standalone Elmwood: the current 12-gate Creek Lane course from the actual cemetery terrain. The displayed route follows the authored lane bends, excluding its starting point from checkpoint numbering.
- Cyan shows the remaining course; gray shows passed gates and completed course sections; gold identifies the next checkpoint; F marks the finish. The mini-map shows nearby upcoming checkpoints and pins a distant next checkpoint to its edge in the correct direction.
- Opening the map provides all numbered checkpoints and a Race route framing button. The start and finish remain visible on both short and long courses. Text labels describe the colors and checkpoint order. No new pulsing or flashing animation was added.
- Checkpoints read the real race progress rather than maintaining a second counter. Free ride and LOVE TAG clear the race overlay. Existing map zoom, compass, touch layout editing, controls, audio and saved progress are retained.

## Changed source files

Both actual game projects: src/detroit/raceMap.ts, raceMap.test.ts, tacticalMap.ts and tacticalHud.css.

Swoop editable source: swoop-source/src/detroit/main.ts, detroitRaceMap.ts and detroitRaceMap.test.ts.

Actual standalone Explorer: C:/Users/digit/Documents/phone/euc-detroit-riverwalk/src/detroit/elmwood-ride.ts, elmwoodRaceMap.ts and elmwoodRaceMap.test.ts. All seven changed Explorer files are mirrored into elmwood-source. The generic race helper and tactical map files match across both products. See love-tag/evidence/race-map-review.json and the refreshed source-revisions.json for file hashes.

## Commands actually run

From swoop-source:

```text
node --experimental-transform-types --test src/detroit/raceMap.test.ts src/detroit/detroitRaceMap.test.ts
node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit
```

Five tests passed, zero failed; TypeScript passed.

From the actual euc-detroit-riverwalk project:

```text
node --experimental-transform-types --test src/detroit/raceMap.test.ts src/detroit/elmwoodRaceMap.test.ts
node node_modules/typescript/bin/tsc -p tsconfig.riverwalk.json --noEmit
```

Five tests passed, zero failed; TypeScript passed. An initial test syntax error was repaired before the passing run.

From the GothTechnology packaging root:

```text
node scripts/build-love-tag-preview.mjs *> docs/love-tag/build-race-map-preview.log
```

Both real products built successfully into the separate .game-builds/love-tag-review directories. A Vite large-chunk warning remains. The initial browser review found a clipped finish badge on the long Swoop course; proportional map framing was added, checked, rebuilt and visually verified.

## Actual browser evidence

Both real product entries were launched through their normal race menus in the Codex in-app browser, at an effective DOM viewport of 1706 × 960. The mini-maps and expanded maps displayed distinct courses with 12 checkpoints and a finish marker. In standalone Elmwood, normal cruise input crossed two actual gates; the map advanced to checkpoint 3 and showed checkpoints 1 and 2 as passed. Switching race → free ride cleared the race course attributes, highlight class and race caption in BOTH products. The latest review reported no captured console errors in either tab.

Saved screenshots:

- C:/Users/digit/.codex/visualizations/2026/09/05/01a073f6-892e-70c1-a9a8-7659bc278528/swoop-race-route-20261003.png
- C:/Users/digit/.codex/visualizations/2026/09/05/01a073f6-892e-70c1-a9a8-7659bc278528/elmwood-race-route-20261003.png

Updated local review URLs, served on port 8212:

- http://127.0.0.1:8212/Jungle-Lotto/lottominded-ultra.io/games/gothtechnology2/arcade/swoop-detroit/?race-map=20261003
- http://127.0.0.1:8212/Jungle-Lotto/lottominded-ultra.io/games/gothtechnology2/arcade/elmwood-explorer/elmwood.html?race-map=20261003

The old port 4181 and GitHub Pages are not these review builds. No full course completion, physical phone/gamepad/VR test, or online/split-screen browser race-overlay test was performed. Swoop's online adapter follows the controlled player's slot; it is typechecked but its new map behavior is not browser-verified. This focused feature does not change any incomplete LOVE TAG acceptance gate or release status.

## Next runnable task

For visual review, open either local link, close the map and resume the paused race. For broader race acceptance, complete each entire course and check the final finish display, then verify split/online player-specific map progression and physical touch use. The separate unfinished LOVE TAG task retains its next steps in love-tag/STATUS.md.
