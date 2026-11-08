# Belle Isle: two-player co-op foundation

Status: **development foundation, not playable co-op and not deployed**. No production entry point, physics loop, network room, rendering configuration, payment/account service or approved release task is changed by these files.

The user explicitly requested `feature/coop-exploration-mode`; it is a separate follow-up branching from approved PR138 source `a7b8a5f7eeefd093e8a81524736530e7c0f317f9`. Do not merge this work into the immutable release candidate or infer publication permission from the approval of PR138. The feature branch is the task-specific exception to the repository's usual upgrade-redesign development destination.

## Verified source locations

All paths below are relative to `lottominded-ultra.io/games/gothtechnology2/`:

- Swoop base rider catalog: `swoop-source/src/detroit/riderChoices.ts`.
- Existing rigged models and embedded clip metadata: `swoop-source/public/exports/rigged-heroes/` and its `manifest.json`.
- EUC / electric-bike profile definitions: `swoop-source/src/detroit/electricVehicles.ts`.
- Belle controllers and existing local races: `belle-isle-source/game/src/belle/racing.ts`, `raceInput.ts`, `hoverController.ts`, and `hover.ts`.
- Belle's locally bundled RideCore and view adapter: `belle-isle-source/game/runtime/ride-core/src/` and `runtime/elmwood-source/src/detroit/riding/threeRiderView.ts`.
- Existing network messages: `belle-isle-source/game/src/belle/onlineProtocol.ts`. Current ExplorerFrame contains pose/mode/seat, not the new selected asset identities. Do not pretend this foundation updates that transport.

## Implemented

`coop.ts` provides allowlisted per-player manifests, separate identities, five inspected base heroes, classic EUC plus city/tour/trail/speed profile IDs, versioned loadout-only persistence, ready-state invalidation, controller ownership, reconnect/pause neutral rearming, independent action edges, a bounded safe-spawn footprint search, landscape/portrait split rectangles and all-or-nothing asynchronous actor preparation with cancellation/timeout/late-resource cleanup.

`lobby.ts` provides a real DOM component with independent player selectors, both-ready gating, conflict/unavailable-controller feedback, keyboard controls, responsive panes and reduced-motion handling. A host must supply `onBegin` to load/validate actors and transition its own world. It is **not imported by main.ts**. The optional `preview` mode explicitly identifies itself as a setup review, not a launched game.

`assetBridge.mjs` inspects existing local Swoop GLBs, verifies their pinned Git blob identity, reads skin and clip metadata and checks the upstream manifest. It does not download/copy assets, alter rigs or claim valid Belle mount fitting. Actual model binaries were not available in this turn's isolated local test workspace, so full real-file inspection has NOT been run. Six bridge parser tests use synthetic GLB metadata.

## Required integration before gameplay acceptance

1. Build one opt-in exploration coordinator owning exactly two actors. Reuse one island scene, one animation loop and one fixed-step simulation schedule. Instantiate distinct RideCore/controller state and correctly cloned skinned views. Apply the chosen Swoop physics profile via the actual `eucHandling` mapping; do not merely relabel the default wheel.
2. Validate both characters' foot contact, bind transforms and animations on the actual island before committing either prepared actor. Copy/share immutable model data, never a mutable skeleton or mixer. Do not unconditionally re-rig already usable Swoop models.
3. Connect `findPairSpawns` to actual `ParkTerrain.land`, `height` and full collision probes. Recheck occupancy when committing after an asynchronous load. It finds potential separation; it does not implement player-player collision or ongoing vehicle contact.
4. Use the existing renderer with `setViewport`/`setScissor`, per-player cameras and restore renderer state afterward. Select vegetation/traffic visibility against BOTH cameras, not their midpoint alone. Preserve shared audio/listener ownership, device budgets, clear input on every modal/focus/disconnect transition, and reject unsupported split-screen XR.
5. Refactor HoverRide's singleton IDs, DOM, sound and input before supporting two hoverbikes. Bicycle/e-bike models/adapters and wardrobe variants are deferred, not silently mapped onto the EUC. Cadillac is not an available asset.
6. Online co-op requires a distinct room handshake containing validated roster IDs, revision, readiness and authenticated seat ownership, authoritative simulation/reconciliation where required, rejoin/leave policy, and tests across two actual clients. A second camera or `transportAvailable=true` is not a working networking implementation.
7. Keep solo and race records, existing friends/voice behavior and persistent saves unchanged. Require actual in-game desktop/mobile screenshots, mixed-vehicle/character fit, controller disconnect tests, network ownership tests and measured two-player frame time before publishing.

## Commands

From `belle-isle-source/game` (existing Node 22+ or Node 24):

```sh
node --experimental-strip-types --test src/belle/coop/coop.test.mjs src/belle/coop/assetBridge.test.mjs
node --experimental-strip-types src/belle/coop/assetBridge.mjs /absolute/path/to/Jungle-Lotto
npx tsc --noEmit --strict --target ES2023 --module ESNext --moduleResolution bundler --lib ES2023,DOM --allowImportingTsExtensions src/belle/coop/coop.ts src/belle/coop/lobby.ts
```

These are targeted commands; the existing repository's normal test runner was not edited. Wire the tests into that runner when the gameplay coordinator is integrated.

## Evidence from this implementation

- 41/41 focused Node tests passed, including failure rollback, late disposal, input ownership and malformed asset data.
- Strict TypeScript compilation of the two modules passed with TypeScript 5.8.3.
- Existing local Chromium/Playwright exercised five offline DOM fixtures: desktop, phone, small phone, landscape and reduced motion. Independent selection, keyboard confirmation, gating, input conflicts, 44px targets and overflow checks passed.
- Connected Browser only supports reading tabs in this conversation. Localhost navigation was administratively blocked; no network policy was changed. UI tests instead used in-memory DOM/script content and mock storage without any network navigation. Storage adapter behavior was unit-tested, but actual browser-localStorage reload persistence was not certified.
- These screenshots are lobby fixtures, not rendered gameplay. No hardware FPS, real-game two-player session, physical controller, online transport, real-file GLB inspection or rig-fit certification is claimed.
