# Belle Isle: local two-player exploration

Status: **integrated candidate; actual island WebGL CI and merge review pending**. The existing solo entry, races, sky/music preferences and saved records remain. This feature lives on `feature/coop-exploration-mode` in PR139, separate from the already merged PR138 photographic release.

## What this candidate implements

- The live island title and ride menu expose **Explore together · 2 players** after startup is ready. Two independent player panes select five existing base Swoop heroes and classic/city/tour/trail/speed EUC profiles. The selected handling is applied through `eucHandling`, not just a different label. All profiles reuse the current EUC mesh.
- Selected GLBs are fetched lazily from their immutable approved commit and checked against their Git blob hashes, embedded-resource rules and required skeleton bones. Duplicate hero selections share immutable asset data, not mutable skeletons, controller state or wheel-light material state.
- Preparation is all-or-nothing with bounded deadlines and cancellation cleanup, existing shader warmup, real foot-contact validation and dry separated spawn footprints. Both actors are prepared before the session becomes visible.
- Two real RideCore controllers run on one 120 Hz pair schedule. Each has its own input binding and live collision queries for the other player. Side-by-side spawn candidates, swept peer contact, recovery and on-foot transitions are independent.
- Two cameras use the existing renderer through viewport/scissor passes. World visibility is updated immediately before each viewport, using that player's position. No second island, WebGL context or animation loop is created. Each viewport restores renderer state on exit, and first person hides only the owning rider for its pass.
- Keyboard, assigned gamepad and per-view touch controls support independent movement. P/Escape pauses both; focus loss/controller changes pause and require neutral rearming. Each view has Camera, Recover, Ride/walk and Join partner. Returning to solo disposes co-op actors and restores the original solo actor and controls.
- The existing music stream remains shared; co-op does not create duplicate audio engines. The old single-rider wheel effect channel is suppressed in co-op rather than played twice at incorrect locations.

## Source mapping

Relative to `lottominded-ultra.io/games/gothtechnology2/`:

- `swoop-source/src/detroit/riderChoices.ts`
- `swoop-source/src/detroit/electricVehicles.ts`
- `swoop-source/public/exports/rigged-heroes/manifest.json`
- `belle-isle-source/game/runtime/ride-core/src/`
- `belle-isle-source/game/runtime/elmwood-source/src/detroit/riding/threeRiderView.ts`

The five base model files at source commit `a7b8a5f7eeefd093e8a81524736530e7c0f317f9` were inspected against their exact blob identities and embedded animations in GitHub Actions. Their bytes are reused rather than adding duplicate models to the Pages bundle. This avoids increasing the existing package by approximately 40 MB. Client download still requires access to the approved raw GitHub URLs; CI serves the identical checked-out bytes for repeatable rig tests, not replacement fixtures.

## Modules

- `coop.ts`: allowlisted manifests, loadout persistence, readiness, keyboard/controller ownership, safe footprint search and cancellation-safe preparation.
- `simulation.ts`: paired real RideCore schedule, chosen motor profiles, conservative peer contact and independent recovery.
- `actors.ts`: hash-checked lazy GLB loading, cloned skinned rider views, actual fit validation and cleanup.
- `lobby.ts`: accessible responsive player selections and readiness.
- `session.ts` / `session.css`: real island launch/leave, per-player views/HUD/input and read-only diagnostics.
- `assetBridge.mjs`: source binary inspection; never automatically re-rigs or modifies an asset.
- `scripts/coop-browser-smoke.mjs`: actual built-island desktop/phone launch, two riders, separate input, pause, camera, recovery, native touch and return-to-solo checks. It never seeds scores or writes player poses.

`preview.html` remains explicitly an offline lobby review; it is not a gameplay acceptance surface.

## Validation completed before this candidate was pushed

- 52 focused Node tests passed: 35 foundation cases, six GLB parser cases, eleven paired real-controller simulation cases. These tests are now registered in the normal `npm test` runner, without removing earlier tests.
- Strict full-game TypeScript checking passed locally using the repository's installed TypeScript 5.9.3.
- All five actual GLBs passed CPU Three.js skeleton/foot-contact tests. Each has 54 bones, independent cloned skeletons and validated standing/turning/braking contact. This is not GPU rendering or hardware-FPS proof.
- Five actual session DOM/CPU fixtures (desktop, phone, small phone, landscape and reduced motion) passed selection, per-player movement, pause, camera independence, renderer-state adapter calls, return-to-solo cleanup and 44px control/layout checks. The fixture used flat terrain and a fake renderer, so it is not evidence of two-player island rendering.
- The earlier foundation CI passed real file inspection, original full game checks and build. It does NOT approve this new integrated candidate.

The new **Belle Isle co-op review** workflow runs desktop and phone real-game WebGL checks. Every current-head required workflow and its actual screenshots/reports must pass before merging. A pending or failed test is not a pass. Software Chromium does not certify physical-phone or hardware 30/60 FPS performance.

## Explicit scope boundaries

This release is **local, same-device, two-player EUC exploration**. It does not implement a new online two-client co-op transport or authenticated loadout synchronization, two independent hoverbikes, bicycles/e-bikes, wardrobe variants, Cadillac, shared quests, split-screen XR, spatial two-rider audio, or competitive records. Existing online features remain separate. No Supabase/Stripe/account/reward contracts are changed. Do not describe missing online or mixed-vehicle functionality as completed.

Production publication is a separate step from merging into the existing PR target `upgrade-redesign`. Do not claim public deployment from a staging merge or from historical PR138 checks.
