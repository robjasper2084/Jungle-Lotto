# Architecture

The game uses Three.js for the Detroit board, camera, environment, landmarks, and token animation; TypeScript modules own all deterministic rules; semantic DOM owns setup, HUD, dialogs, settings, and results.

## Boundaries

- `app/src/engine`: serializable state, actions, reducer, RNG, movement, economy, signals, scoring, and CPU policy. No Three.js imports.
- `app/src/content`: geographic Detroit anchors, major-street polylines, a 36-stop clockwise circuit, eight networks, 24 ventures, and 48 cards.
- `app/src/render`: disposable Three.js render state. It reads snapshots and emits no game-state mutation.
- `app/src/services`: save migration, Wallet adapter, and server-verified reward-claim payloads.
- `app/src/main.ts`: one integration boundary that dispatches actions, drains movement animations, autosaves, and renders the DOM.

Every state change passes through `GameAction` and `reducer`. The reducer queues the movement result; the UI waits for `DetroitBoard3D.animateRoute` before dispatching `COMPLETE_MOVEMENT`, so destination data is not resolved early.

Vite builds from `app/` into the game route with `base: "./"`; source remains intact and generated assets live in `assets/build/`. The service worker scope is `./`, so it cannot control the parent site.
