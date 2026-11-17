# Belle Isle Explorer — three-stop visual-quality showcase
**Stage:** combined, unmerged review candidate (PR #172 visual layers + PR #173 Blender asset tooling).
**Route:** MacArthur Bridge → Nashua Canal / Wooded Canals → Blue Heron Lagoon.
**Reference:** Michigan DNR park map, Historic Detroit MacArthur Bridge, Friends of the Detroit River Blue Heron Lagoon restoration.

## Scope and behavior
- Adds a dedicated three-stop section to the Island Guide. Each button invokes the **existing** landmark Travel handler, so it does not change ride physics, street/path geometry, collision, camera code, map coordinates, quality selection, or flight controls.
- Resolves map IDs by strict name and coordinate checks; refuses to substitute a different location when a POI is missing.
- MacArthur = `macarthur-overlook`; Wooded Canals = mapped `Nashua Canal` POI `32613741`; Blue Heron = `32613819` and the explicit lagoon habitat view.
- The inherited PR #172 supplies weathered bridge surfaces, varied canopies, canal roots, geology LOD and shoreline sediment. PR #173 adds Blender GLB preflight tooling. **New Blender-exported models and external photographic texture maps are not shipped by this patch.**

## Visual evidence
- Run `ENV_GALLERY_QUICK=1 ENV_GALLERY_DEVICE=desktop node scripts/showcase-gallery.mjs` for the quick desktop proof, or use `ENV_GALLERY_DEVICE=desktop node scripts/showcase-gallery.mjs` for all three quality tiers at high noon and sunset. Repeat with `ENV_GALLERY_DEVICE=phone`.
- Uses actual browser game, public Island Guide Travel buttons and GPU fence checks, and verifies selected destination and selected quality before writing each screenshot.
- Quick CI: 3 destinations × 1 device quality × noon; full manual sweep: 3 destinations × 3 quality modes × 2 lighting presets per device. Browser screenshots and data records are under `game/output/showcase-gallery/{desktop,phone}/`.
- Review photographs visually: confirm bridge arches and piers, Sylvan waterline visible (not only flatwoods), Blue Heron inlet / footbridge, rock placement, foliage silhouettes, LOD popping, no water depth artifacts, no invisible blockers.
- The browser SwiftShader run is **not** measured physical-device frame-rate certification. Compare p50/p95/p99 frame times, WebGL/asset errors, network requests, draw calls and startup bytes against the published baseline. Desktop 60 FPS and phone 30 FPS remain targets.

## Release boundary
Do not merge into `main`, update production asset pins or deploy GitHub Pages until exact-head CI and visual/device review pass and a distinct release approval is given. Existing PRs #172 and #173 are preserved independently. On-demand generated imagery is reference-only, not a new asset or evidence of rendered game content.
