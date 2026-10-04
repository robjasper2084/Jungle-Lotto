# Both-games polish checkpoint — October 4, 2026

This is an implemented source/package increment, not a completed playthrough or a verified mobile frame-rate claim.

## Changes
- Swoop city surfaces use shared miter normals at polyline bends, terrain-draped clipped crossings, and a spatial terrain-tile index. Paths/sidewalks no longer paint raised patches over same-grade motor streets. Grade-separated bridges stay separate. Coarse asphalt support faces are suppressed near mapped ribbons across the city; brick plazas are retained.
- The separately packaged Elmwood Explorer has a shorter first menu: Explore, Race, Play, Practice, and LOVE TAG. Rider/bike/graphics/local split/other activities remain under More options. Existing handlers, choices, saved touch layouts and settings are preserved.
- Both LOVE TAG adapters update visible terrain, scenery streaming, sun/lighting and automatic detail around the actual local predicted/authoritative rider. Swoop's Tag rendering no longer follows a paused non-Tag ride's 30 Hz idle schedule. This fixes a skipped host rendering branch, not the server rules.
- Original, separate urban pavement and Elmwood grass daylight/ground-bounce environments were rendered with Blender Cycles on NVIDIA OptiX / RTX 3080. HDRs are used for reflection/ambient lighting with the existing real-time sun and weather. These are procedural art, not photographs or a surveyed lighting capture.
- The existing plain-text multiplayer chat, per-device display choices, optional online split view and Expert AI fill remain included.

## Executed evidence
- Hardware: NVIDIA GeForce RTX 3080, driver 610.60, 10,240 MiB.
- NVIDIA skill catalog: CLI list failed Windows Git schannel; fallback official catalog read. No strong installed/new catalog skill matched this WebGL asset workflow. No plugin installed, credits spent or driver preferences changed.
- Installed Blender 5.2 was run headlessly using scripts/bake-skylights-optix.py. Both 1,024 x 512 / 64-sample HDR renders used OptiX on the RTX 3080: 3.72 / 3.75 seconds. See love-tag/nvidia-lighting-report-20261004.json and nvidia-optix-lighting-20261004.log.
- 14 street geometry/crossing/Atwater/grade/fringe regression tests PASS. See global-surface-joins-index-final-20261004.log.
- Actual mapped-road/path CPU benchmark: 28,764 segments, 387,152 baseline vs 356,555 joined triangles (about 7.9% fewer). Latest CPU tessellation was 11.290 / 13.367 seconds, so the geometry repair does add construction work. This sample excludes curb overlays, draw calls and GPU frames; it is not a gameplay speed claim.
- Actual Swoop and separately packaged Explorer typechecks PASS; shared Core and portable Core builds PASS.
- Final paired game packaging, Store build, revision receipt and complete Pages assembly PASS. The refreshed artifact is 1016.7 MiB, below the 1024 MiB limit; original authoring data/media remain in source.

## Browser review update
User approval resolved the earlier access rejection. Real Create/Join invitation flows, two human players per product, independent guest driving, Classic results, rematches and clean UI exit were exercised on localhost:8212. Explorer's five-second interruption recovered the same seat. Current 390x844 menu checks have no horizontal overflow; main Play/Practice/Tag actions and the Explorer More disclosure work. This is scoped loopback/browser-size evidence. See love-tag/STATUS.md for the browser-found query/gzip bug, phone overlap fixes, HDR calibration and lean packaging changes.

## Remaining
- Full-map human race/Tag traversal and comprehensive scenery/collision checks are NOT RUN. Approved final packaged phone HUD/display/offline samples passed: Explorer portrait 369 x 844, Swoop landscape 844 x 390, no horizontal overflow, chat/map clear the riding buttons, and 50% resolution changes the real render buffer. Both offline sessions run with the server stopped. See love-tag/STATUS.md for exact evidence and limitations.
- Physical phone/gamepad/VR and eight-player GPU frame-time/resource profiles are NOT RUN.
- Hosted LOVE TAG remains BLOCKED by missing authorized HTTPS/WSS hosting. Normal online race transport for standalone Explorer is NOT IMPLEMENTED; Expert local races and actual online Tag code exist.
- Static publication remains pending until the scoped GitHub release succeeds. No pending state should be called live.

## Reproduction
From the packaging project:
- node --experimental-transform-types --test swoop-source/src/detroit/street-geometry.test.ts swoop-source/src/detroit/streetJunctions.test.ts swoop-source/src/detroit/streetSidewalk.test.ts
- node --experimental-transform-types scripts/benchmark-street-joins.mjs
- Blender 5.2 --background --python scripts/bake-skylights-optix.py -- --output .game-builds/nvidia-polish
- node scripts/build-riding-games.mjs
- node docs/love-tag/record-full-map-revisions.mjs --release

Source changes were made in the real projects, not the generated JS/CSS. See the release revision receipt for exact source and package SHA-256 values.
