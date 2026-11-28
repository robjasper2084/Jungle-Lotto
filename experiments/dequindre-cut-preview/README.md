# Dequindre Cut whole-map preview

**Unpublished development candidate. The user has explicitly held integration until the other game branches are finished and they are ready. Do not merge or deploy this work.**

This workspace adapts the existing Swoop Detroit world into the Belle Isle runtime. It uses the existing map, models and textures at their original quality. The integration lives entirely under `experiments/dequindre-cut-preview/`; production game entry points, source modules, dependencies, packaging and deployment configuration remain unchanged.

## Run locally

Use Node 24 and a checkout containing the original Belle Isle and Swoop source assets:

```sh
cd experiments/dequindre-cut-preview
npm ci
npx playwright install chromium
npm test
npm run check
npm run dev
```

Open `http://127.0.0.1:8317/`. A local build can be reviewed with:

```sh
npm run build
npm run preview
```

Both servers bind to localhost. This workspace has no publish or deployment command.

The source baseline is `893f769838166e6e35624b7b979ed5cbb8414507`. The build checks exact source hashes before applying the small in-memory adapters. If an upstream source changes, compilation stops and the integration must be reconciled deliberately before updating its pinned hashes.

## Asset-backed review

The compiled preview is written only to this workspace's ignored `dist/` directory. Its `preview-manifest.json` records the source baseline, transformed modules, and original asset identities.

Models, textures and audio are served read-only from the original checkout. The built-preview server verifies each asset against the Git blob identity recorded when it was built, and rejects changed bytes. This avoids duplicating the games' large media trees merely to review the branch. The `dist/` folder alone is therefore **not a self-contained distributable**; review it with this checkout and `npm run preview`.

The required asset roots are:

- `lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/public/`
- `lottominded-ultra.io/games/gothtechnology2/swoop-source/public/exports/`
- `lottominded-ultra.io/games/gothtechnology2/swoop-source/public/textures/`
- `lottominded-ultra.io/games/gothtechnology2/swoop-source/public/audio/`
- `lottominded-ultra.io/games/gothtechnology2/store/public/arcade/swoop-detroit/exports/`
- `lottominded-ultra.io/games/gothtechnology2/store/public/arcade/swoop-detroit/textures/`
- `lottominded-ultra.io/games/gothtechnology2/store/public/arcade/swoop-detroit/audio/`
- `lottominded-ultra.io/games/gothtechnology2/store/public/arcade/swoop-detroit/shared-textures/`

Swoop asset URLs receive a dedicated `/__swoop-assets__/` namespace during preview compilation, so similarly named Belle Isle assets cannot be substituted accidentally. The original source build proxies media to an asset server: its source-public tree alone does not contain all referenced models, cut textures or audio. The preview therefore uses an explicit source-public-first overlay with the original published media as fallback. Model-relative shared-texture URLs stay in that same namespace. The manifest records the selected source path and exact Git blob; a changed primary asset or changed source selection is rejected, never hidden by fallback. No texture variants, replacement images, global fetch or loader implementation are introduced.

## Isolation and quality constraints

- One Belle Isle renderer, player runtime, camera and control system.
- Complete existing authored Cut content, with its original terrain, ramps, bridges and asset references.
- One documented map-frame adapter for positions, headings, ground normals, rays and collision queries.
- Overlapping simplified mainland visuals are clipped or replaced only where the imported world supplies the corresponding surface. Existing Jefferson connections and Elmwood remain available.
- Original texture dimensions and source geometry are retained on compact screens. Reduced-motion preferences remain honored.
- Preview scenery settings are separate from the host's DOM quality settings.
- Preview travel prepares the destination's original assets before using the native travel action. Preparation holds the existing scene lock, clears held input, and offers a visible retry if an asset fails.
- Production online-room and voice transports cannot enter the preview bundle. Multiplayer buttons explain the offline preview; the original local co-op and offline race controls remain available.
- Renderer/source imports are validated before each build; importing Swoop's complete second game runtime is refused.
- Existing production entry points and deployment workflows stay unchanged.

## Validation

`npm test` runs the integration's source-alignment, geometry/physics, source-transform, asset-integrity and isolation tests. Node's test resolver uses only this workspace's dependencies; no repository-root `node_modules` symlink is needed.

`npm run verify:isolation` checks the pinned production files, candidate file scope and existing Pages deployment boundary. Every emitted preview bundle also verifies that exactly one Three.js installation was bundled.

Native browser route, visual and performance evidence must be retained separately from the unit checks. The production acceptance requirement remains the unchanged 90-second desktop and phone runs, p95 at or below 50 ms, and zero intervals above 250 ms. Streaming transitions and unfavorable samples belong in that evidence. The existing production workflow gates remain mandatory before any eventual integration.

With the local preview server running, the supplemental browser checks are:

```sh
npm run test:browser
npm run test:browser -- --phone
npm run test:browser -- --compact --reduced-motion
```

The desktop check uses native keyboard input. The phone checks use native browser touch events on the game's real joystick. They visit Atwater, Freight Yard, Mack Avenue and the original island start through the preview's user-facing travel buttons, capture actual game screenshots, check travel-target bounds, and retain browser errors. Compact mode uses a 320 × 568 viewport. Each run writes its own timestamped evidence directory; unfavorable runs are not overwritten.

The browser check compares imported route length, terrain chunks, triangle counts, building meshes, geospatial meshes and landmarks against an independent inventory constructed from the unmodified Swoop source. It also requires the complete-scene connector checks in both directions, actual native movement, visible imported meshes and no missing source assets. Startup and travel waits stop immediately when the actual preview reports an error, a native loader fails or an unhandled browser error appears. Failures retain a screenshot and loading/state snapshot whenever the browser is available. Asset tests verify all five original Cut JPEGs, a published-only model and its original external JPEG dependencies before the browser run.

An optional `--profile` appends 30 seconds of native movement at each of Atwater, Freight Yard and Mack Avenue. It samples continuously before the first travel action through the last segment, retaining all callback intervals, travel-dialog transitions and asset loads with segment timestamps. Its report labels those observations as supplemental browser callback measurements. It does not substitute them for the original rendered-frame performance gate or imply hardware certification. The default browser is the Chromium installed by Playwright; use `DEQUINDRE_CHROME` to select another installed Chrome/Chromium binary. Set `DEQUINDRE_HEADED=1` for a visible browser, and `DEQUINDRE_PREVIEW_URL` only for another localhost port.

## Isolated CI evidence

`.github/workflows/dequindre-cut-preview.yml` runs only on pushes to `staging/dequindre-cut-whole-map-20261127` that change this preview or that one workflow. Its job repeats the exact branch guard, checks out the pushed revision without retained credentials, and has only `contents: read` permission. There is no manual trigger, pull-request action, publishing step, environment or release permission. A sparse checkout includes the same original source and asset trees used locally, leaving unrelated sites and generated bundles out.

The one Ubuntu job is bounded to 30 minutes. It installs the preview dependencies, checks types/tests/isolation, builds the preview, records the independent source inventory, and installs official Playwright Chromium. It then starts only a localhost server and runs these three native-browser checks:

```sh
npm run test:browser -- --profile
npm run test:browser -- --phone --profile
npm run test:browser -- --compact --reduced-motion
```

The first two include the complete functional route smoke before their continuous source-route observations, avoiding redundant browser boots. Each run retains its failures; the suite attempts the remaining device checks even if an earlier one fails. Toolbar bounds and overlap, the offline-room notice, prepared travel, full source counts, both connector directions, real movement and source assets are checked. CI uploads only reports, screenshots, server logs, source inventory and `preview-manifest.json`. It never uploads a Pages artifact or the game bundle. The workflow boundary itself is covered by fail-closed isolation tests.

To run that same suite against a completed local build, stop any existing server on port 8317 and run `node scripts/run-browser-suite.mjs`. The script owns and shuts down its localhost server. These are functional draft diagnostics; the existing native production acceptance remains a separate requirement.

Passing these checks does not grant release authorization. The user will decide when this candidate may join the game after their other branches are ready.
