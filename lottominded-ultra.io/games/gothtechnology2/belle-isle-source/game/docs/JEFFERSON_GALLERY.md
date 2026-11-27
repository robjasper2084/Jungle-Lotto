# Jefferson assets: actual game gallery

`scripts/jefferson-asset-gallery.mjs` captures the built game at the assigned Jefferson workshop and market. The script has a fixed eight-minute ceiling per device/build variant. It does not modify or replace the existing 90-second native performance checks.

It starts through the visible start screen, selects One wheel, configures High Noon with the sky cycle off, and walks along the authored road waypoints with native input. The western market uses the existing **Detroit guide → Swoop Detroit · Dequindre Cut at East Jefferson → Travel to path** action before a shorter native walk. Desktop travel and coarse turns use trusted browser keyboard events. Fine desktop turns use native mouse drags on the existing fixed joystick, enabled through visible Settings during the route. The touch HUD is switched off through Settings and checked before every desktop screenshot. Phone movement uses the same joystick with native CDP touches and the shared touch-sequence cleanup helper. First-person look uses ordinary mouse or touch drags. No script sets the actor pose or camera.

Near the requested heading, both devices use a smaller native joystick displacement, accounting for the existing 9% deadzone and .92 response curve. This avoids repeated full-steer microtaps while retaining the .025-radian route-heading tolerance, 24-pulse bound and 240 ms settling period. Each correction records the requested axis magnitude, pointer type, joystick radius, native displacement and resulting heading. Cleanup tracks uncertain mouse/key presses, attempts to release every held input, and retains release failures in the report.

The query-gated `__jeffersonGalleryState()` observer supplies read-only actor, camera and adapter evidence. The script requires actual active-frame advancement and a successful WebGL GPU fence before each PNG. Initial building publication has a bounded 60-second wait inside the overall run deadline; adapter errors abort immediately. A missing observer, incorrect build variant, fallback building load, visible old proxy at the photographed nearby target, native route stall, missing frame proof or HTTP/runtime error leaves the run failed. A distant building's original proxy is a valid LOD and is retained. Failed states stay in the report; they are not replaced with synthetic renders.

## Build and run

Use Node 24 and the repository's existing installed dependencies. Run from the `game` directory. Build the same source twice with the adapter toggle baked into each production build; preserve each complete build directory. Do not change the adapter toggle at runtime or reuse a stale bundle.

```sh
VITE_JEFFERSON_ASSET_SKINS=0 npm run build
cp -a dist dist-jefferson-baseline
VITE_JEFFERSON_ASSET_SKINS=1 npm run build
cp -a dist dist-jefferson-candidate
```

On the existing macOS Chrome/Metal runner, capture each device against both separate builds. Each command below is a separate run with its own unchanged eight-minute ceiling:

```sh
ENV_GALLERY_REQUIRE_METAL=1 JEFFERSON_GALLERY_VARIANT=baseline JEFFERSON_GALLERY_DEVICE=desktop JEFFERSON_GALLERY_BUILD_DIR=dist-jefferson-baseline node scripts/jefferson-asset-gallery.mjs
ENV_GALLERY_REQUIRE_METAL=1 JEFFERSON_GALLERY_VARIANT=candidate JEFFERSON_GALLERY_DEVICE=desktop JEFFERSON_GALLERY_BUILD_DIR=dist-jefferson-candidate node scripts/jefferson-asset-gallery.mjs
ENV_GALLERY_REQUIRE_METAL=1 JEFFERSON_GALLERY_VARIANT=baseline JEFFERSON_GALLERY_DEVICE=phone JEFFERSON_GALLERY_BUILD_DIR=dist-jefferson-baseline node scripts/jefferson-asset-gallery.mjs
ENV_GALLERY_REQUIRE_METAL=1 JEFFERSON_GALLERY_VARIANT=candidate JEFFERSON_GALLERY_DEVICE=phone JEFFERSON_GALLERY_BUILD_DIR=dist-jefferson-candidate node scripts/jefferson-asset-gallery.mjs
```

Without `ENV_GALLERY_REQUIRE_METAL=1`, the shared gallery launcher uses its existing headless SwiftShader lane. That can produce labeled visual diagnostics but cannot establish the mandatory Metal desktop performance result. The actual renderer is always recorded. Phone dimensions are 390×844; desktop dimensions are 1440×900; both use DPR 1, reduced motion, a 60 FPS cap, and the existing smooth/high quality settings respectively.

For a local diagnostic with an existing system Chromium, set `JEFFERSON_GALLERY_BROWSER_EXECUTABLE=/usr/bin/chromium`. The script keeps the shared software launch arguments and records this path. An executable override is rejected when the Metal lane is required.

`JEFFERSON_GALLERY_HEAD` can record a local source SHA; GitHub Actions uses `GITHUB_SHA`. `JEFFERSON_GALLERY_OUTPUT` overrides the output directory. `JEFFERSON_GALLERY_PAIR_REPORT` points to an opposite-variant report when it is not in the default location. These settings do not alter the time budget, renderer checks or input rules.

## Evidence and review

Output is under `output/jefferson-gallery/<baseline|candidate>/<desktop|phone>/`:

- `index.html` displays the actual unedited browser screenshots.
- PNGs show the facade/corner and, where selected in the authored target data, a ground-level roofline and an 85 mm sign-area view reached through the existing Camera/Viewfinder UI. The workshop sign uses the existing 4× zoom at the same waypoint; other signs reset to 1×. Native End/Home key actions on the focused Camera zoom control select those values.
- `report.json` records exact route waypoints and observed arrival poses, camera position/direction/FOV, actual camera lens/zoom/viewfinder settings, source/variant, renderer, frame counters, GPU fence completion, adapter assignments and fitted bounds, original-proxy visibility, HTTP/runtime errors, native input receipts, steering displacements and cleanup. Each screenshot also records whether touch controls were enabled.

The script reads `JEFFERSON_CAMERA_TARGETS` from `src/belle/jeffersonPlacements.ts`; targets must name an assigned building and provide an authored road route and view. A sign-area fallback aims at the facade band and is labeled as such. Exact lettering placement, readable type, ground contact, facade proportions, roof joins, seams, adjacent-building clearance and obstruction still require inspection of the actual screenshots. Ground-level evidence cannot certify hidden roof faces or every nearby collision surface.

When the corresponding separate-build report exists, complete pairing requires the same recorded source SHA and settings, with actual cameras within 1.5 m position, 2° direction and .05° FOV. These deltas are saved per frame. Missing SHA provenance keeps complete pairing unconfirmed. An unmatched view must not be presented as a camera-matched improvement. The script's `passed` field means the bounded native capture completed without recorded errors; it does not mean manual visual acceptance or performance certification. Keep the unchanged 90-second desktop and phone reports alongside this gallery when reviewing the integration.
