# Architecture

The game uses Phaser 3 for the illustrated Detroit board, camera, environment, landmarks, and token animation; TypeScript modules own all deterministic rules; semantic DOM owns setup, HUD, dialogs, settings, and results.

## Boundaries

- `app/src/engine`: serializable state, actions, reducer, RNG, movement, economy, signals, scoring, and CPU policy. No Phaser imports.
- `app/src/content`: geographic Detroit metadata, a 36-stop clockwise illustrated circuit, eight networks, 24 ventures, and 48 cards.
- `app/src/scene`: disposable Phaser render state. It reads snapshots and emits no game-state mutation.
- `app/src/services`: save migration, Wallet adapter, and server-verified reward-claim payloads.
- `app/src/main.ts`: one integration boundary that dispatches actions, drains movement animations, autosaves, and renders the DOM.

Every state change passes through `GameAction` and `reducer`. The reducer queues the movement result; the UI waits for `BoardScene.animateRoute` before dispatching `COMPLETE_MOVEMENT`, so destination data is not resolved early.

Vite builds from `app/` into the game route with `base: "./"`; source remains intact and generated assets live in `assets/build/`. The service worker scope is `./`, so it cannot control the parent site.
