# Belle Isle Explorer — Blender & CC0 bridge-material workflow

**Status:** authoring pipeline in draft PR #172. Neither new PBR source maps nor an exported bridge/rock GLB has been validated or published. The existing procedural bridges, roads, collisions and mapped scenery remain the playable baseline. PR #171's separate bridge/atmosphere changes remain independent.

## Why these sources
Use **Poly Haven** 1K CC0:
- Weathered concrete: [Concrete Slab Wall](https://polyhaven.com/a/concrete_slab_wall), ID `concrete_slab_wall`
- Corroded metal: [Rust Coarse 01](https://polyhaven.com/a/rust_coarse_01), ID `rust_coarse_01`

Both are reference-grade texture inputs, not survey data for the exact Belle Isle structures. The user-provided photos define stone scale, bridge arch shape, canopy, water clarity and color grade. Do not copy Google Images photos into a published texture atlas: they may be copyrighted. Keep them as **local Blender viewport references**.

Poly Haven API authoring requests use a distinct User-Agent, validated source host and 1K maps with MD5 (when reported) and SHA256. Offline authoring source only: the running website must **never call the Poly Haven API**. Credit: **PBR material sources by Poly Haven (CC0)**, [Poly Haven API](https://polyhaven.com/our-api). AmbientCG is an equally valid optional CC0 source for manual authoring, but this pinned pipeline currently uses two confirmed Poly Haven IDs.

## How to run

From `lottominded-ultra.io/games/gothtechnology2/belle-isle-source/`:

```bash
# Cache 1K color, OpenGL normal and ARM maps (AO R, roughness G, metalness B).
python3 tools/fetch-belle-pbr.py --manifest authoring/environment/bridge-pbr-sources.json --out authoring/environment/cache

# Install the standalone compressor for the game’s Meshopt loader.
npm install --global @gltf-transform/cli

# Use Blender 5.2+ with its glTF 2.0 exporter; supply a local editable
# world/bridge .blend or selected authored .glb (neither is downloaded here).
blender -b --python tools/blender-belle-environment.py --   --source /path/to/Belle_Isle_World.blend   --cache authoring/environment/cache   --output game/output/environment   --refs /path/to/local/reference-photos   --mode bridge

# Repeat with an authored *visual-only* rock asset for three rock LODs.
blender -b --python tools/blender-belle-environment.py --   --source /path/to/shoreline-rocks.blend   --output game/output/environment   --mode rock

# Confirm Meshopt-compressed GLB version, size and triangle budgets.
node tools/validate-belle-glb.mjs game/output/environment/belle-bridge-visual-lod0.glb
node tools/validate-belle-glb.mjs game/output/environment/belle-rock-visual-lod0.glb

# After a clean build, capture actual game views separately for every graphics tier:
cd game
npm ci && npm run check && npm test && npm run build
ENV_GALLERY_DEVICE=desktop node scripts/environment-gallery.mjs
ENV_GALLERY_DEVICE=phone node scripts/environment-gallery.mjs
```

Output resides in `game/output/environment/` and `game/output/environment-gallery/{desktop,phone}/`; these folders are **not production assets**. Do not copy new GLBs into `game/public/belle/` or add them to the startup pin list without first verifying screenshot and profile comparisons and GLTFLoader readiness. A successful Blender export is not a completed in-game integration.

## Blender setup
- **Sapling Tree Gen:** In Blender 5.2+, install the **Sapling Tree Gen** extension using Preferences → Get Extensions (it is no longer implicitly bundled in all supported versions). Generate a few species with crown-height/density variants; **do not add hundreds of unique rendered tree objects**. Author prototypes in Blender and transfer deterministic placement rules to the existing `naturePlan` and instanced LOD pipeline.
- **GScatter (optional):** weight-paint narrow strips along mapped woodland canals and use its placement/collision restrictions to develop tree/root groups. Export a compact set of source meshes and canonical coordinates; keep distributed trees in the game's existing instancing system, not a monolithic scatter mesh.
- **Node Wrangler (optional):** convenient for authoring a Shader Editor Gradient → Color Ramp and mixing Principled PBR surfaces, but Blender shader nodes do **not automatically export** Three.js custom water/refraction shader logic. Implement river/lagoon depth controls in `game/src/belle/water.ts` after verified geometry and performance data. The current Koi pond already has partially transparent water; other lagoons still need separately validated depth/bed layers.
- **Auto-LOD plugin (optional):** do not depend on any one plugin or unverified tool version. The included exporter generates standalone LOD0, LOD1, LOD2 meshes via Blender Decimate *Collapse*. Use *Planar/Dissolve* for hard-surface panels only; it can destroy organic rock silhouettes.
- **Compression:** This game configures `GLTFLoader.setMeshoptDecoder`. The authoring exporter uses offline **glTF-Transform CLI** with Meshopt and **rejects silent fallback to Draco**, which would require new runtime DRACOLoader setup. Generated materials use the OpenGL +Y normal convention and 1K color/ARM maps. Exported LODs are independent; a runtime distance selector must load one tier, never all three concurrently.

### Atlas baking and ambient occlusion
A shared **ORM packed map** already carries AO (R), roughness (G) and metalness (B). For static bridge hardware, a single UV atlas can be baked *after* UV islands have been inspected for stretching/seam overlap; don't force UVs for long bridge decks into a small atlas. Blender and glTF can represent PBR maps, but AO textures alone don't replace accurate shadowing/SSAO or a lightmap. Any baked AO must be evaluated in game with its intended UV set. The current pipeline retains two source material families; a final merged draw-call atlas is **not yet validated**.

### Authoring safety
- Geographic units are metres; browser X east / Y up / Z south; Blender Z-up is converted by the glTF exporter.
- No changes to `ParkTerrain`, bridge obstacle shapes or race course gates when exporting visual LODs.
- Do not extend the Sky Coastline Circuit **45s GPU presentation deadline** to hide regressions. Rock colliders are analytic and spatially indexed: decimating rock render meshes is not evidence that a CPU collision mesh caused the original timeout.
- Compare MacArthur Bridge, wooded canal, provisional red-footbridge/covered-bridge viewpoint, and swimming beach at **12:00** and **17:48**. The red-footbridge travel target must be visually confirmed; the gallery records that distinction.
- Check total triangles, draw calls, GLB downloaded bytes, shader programs, p50/p95/p99 frame pacing on desktop, touch phone, and co-op. Existing targets 60 FPS desktop/30 FPS midrange phone are **targets**, not a certified outcome.

## Acceptance and promotion
Keep draft PR #172 separate from draft PR #171 until all required exact-commit tests succeed, all eight real game environment captures are reviewed, and the Blender-exported assets have been validated visually. Prefer a dedicated staging branch instead of changing `main`. Only publish with explicit production authorization, a successful Pages build/deploy for the merged SHA, and public desktop/phone game verification.
