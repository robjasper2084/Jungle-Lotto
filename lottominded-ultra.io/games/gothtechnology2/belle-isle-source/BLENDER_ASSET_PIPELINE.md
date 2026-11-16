# Belle Isle Explorer — Blender environment asset pipeline

**Status:** Authoring and GLB preflight tooling only. No new models or external texture bytes are included in this change. No game-world geometry, race routes, physics, shoreline collision, production asset pins or deployment was changed.

**Compatibility target:** Blender 4.5/5.2 authoring; existing Vite + Three.js game. `game/src/belle/world.ts` currently configures `MeshoptDecoder` but no `DRACOLoader`. `game/src/belle/nature.ts` has its own GLTF loader; never assume all loader instances support the same extensions.

## 1. CC0 reference materials

Use the two specifically reviewed textures below at **1K or 2K** resolution first (avoid huge 8K/16K downloads in production). The project already has a substantial world-skin material library (`game/public/belle/skins/`), so trial materials should replace—not simply add to—the relevant bridge/shore textures after an A/B comparison.

| Purpose | Material | Terms | Recommended maps |
|---|---|---|---|
| Concrete bridge arches, abutments, curbs | https://polyhaven.com/a/concrete | CC0 | Albedo (sRGB), tangent-space GL normal, roughness, optional AO |
| Weathered railings / rusted bridge joints | https://polyhaven.com/a/rusty_metal_sheet | CC0 | Albedo (sRGB), tangent-space GL normal, roughness, metallic; rust and paint should not be treated as uniformly metallic |
| Alternative surface library | https://ambientcg.com | CC0 | Download and record the exact asset ID/license before using |

Poly Haven and ambientCG both publish CC0 asset terms (https://polyhaven.com/license and https://docs.ambientcg.com/license/). Keep a copy of the material's name, source URL, license, resolution and local map hashes in the art handoff. This change does **not** download or vendor those materials.

In Blender, use Principled BSDF: **Base Color** as sRGB, **Normal/OpenGL** through Normal Map node as Non-Color, and roughness/metalness as Non-Color. Use Node Wrangler if available, but do not rely on it during headless export. Check tangent-space direction: do not interchange DirectX vs OpenGL green channels. Metallic and roughness packing must match glTF's ORM channels (occlusion R, roughness G, metallic B). An ORM texture is different from a color atlas.

## 2. Nature, shoreline and true water-depth mapping

- Keep the current browser-instanced near/far vegetation and `vegetationLod.ts` shader; the app already switches tree density and leaf crowns by quality. Generate **source plant varieties**, not thousands of unique draw meshes.
- For Blender 5.2, install the **Sapling Tree Gen extension** compatible with the selected Blender version; it is no longer universally bundled. Gscatter can drive weight-painted slope/shoreline distribution and varied canopies, but apply/realize Geometry Nodes instances before tagged mesh export. Do not use its high-density authoring scatter verbatim as WebGL runtime geometry.
- Ground plants/roots must clear road and trail shoulders. Preserve the live bridge deck, greenhouse navigation and lagoon routes; do not export a second invisible floor or full-landmass collision mesh.
- Existing `water.ts` already implements river and lagoon shaders. A Blender Gradient Texture/Color Ramp gives a visual gradient but **cannot measure water depth**. To reveal submerged rocks, bake or derive a bounded shallow-water/bathymetry mask in map coordinates; blend muddiness and clarity by that mask with the current water level, not a random UV direction. Prefer opaque/dithered shallow zones on mobile; measure overdraw before trying full alpha transparency.
- Treat rock **render LODs** and **collision proxies** separately. Planar dissolution can make collision simpler, but GPU submission stalls are diagnosed with render geometry, texture bandwidth, shaders and driver timing; simplified colliders alone cannot fix them.

Reference photography may be loaded as a Blender Image Empty / Background with explicit scale and camera orientation. Do not redistribute Google imagery or photographs unless their reuse rights permit it. Project game coordinates use metres and the browser world uses X east, Y up, Z south; verify Blender-to-glTF axes against an existing bridge/map anchor before staging.

## 3. Safe headless export

Create a *copy* of the authoring `.blend` and tag only the source mesh assets being approved. For each mesh, set custom properties:

- `belle_export = True` (Boolean), or put the mesh in a collection named `BELLE_EXPORT`
- `belle_role = "rock"` / `"bridge"` / `"shore"` / `"waterbed"` / `"tree"` / `"foliage"` / `"prop"`
- Optional `belle_asset_name = "BRIDGE_RAIL_A"` (unique, alphanumeric/underscore)

The export script makes evaluated (modifier-applied) mesh copies *without saving or editing the source `.blend`*. It produces `ASSET__LOD0`, `ASSET__LOD1`, `ASSET__LOD2`, and for rocks `ASSET__COLLIDER`, including JSON metadata. Typical high/medium/low decimation ratios are 1.0 / .52 / .24; planar dissolve is used on the independent rock collider. Inspect the resulting silhouettes, silhouette-critical bridge details and normal shading before promotion.

```bash
# Execute from belle-isle-source/ with Blender available locally.
blender -b /path/to/Belle_Isle_Environment.blend \
  --python tools/export-belle-environment.py -- \
  --output game/output/belle-blender/belle-environment.glb

# GLB must exist before running preflight; this does not require Blender.
node tools/validate-belle-asset-pack.mjs \
  game/output/belle-blender/belle-environment.glb
node --test tools/validate-belle-asset-pack.test.mjs
# For a complete environment study, require all four families:
node tools/validate-belle-asset-pack.mjs game/output/belle-blender/belle-environment.glb --require-families=bridge,foliage,water,rock
```

The exported `belle-environment.json` sidecar reports triangle counts and source material names. **Never add the entire exported GLB scene directly to the game**: doing so would render all three LODs and the collider simultaneously. A future runtime integration must select exactly one active render LOD, omit `__COLLIDER` from rendering, register simplified collision only with the existing `ParkTerrain.flightSolids`/obstruction system, and reuse the current quality/distance controls. This change intentionally provides a vetted interchange boundary, not a new runtime loader.

The exporter requires selected-only export and custom-property support in the Blender glTF add-on; it fails rather than accidentally exporting the full scene. `waterbed` means underwater or shoreline geometry only, **not** a replacement for the existing live water shader.

The exporter explicitly disables **Draco**; the preflight rejects **Draco**, **Meshopt** and **KTX2** exports for this interchange until every loading path is explicitly decoder-wired; the existing first-load packer may later transform the approved files. Blender's `export_apply` alone and a compressed GLB do **not** guarantee smaller GPU draw calls. Disable source bevel/subdivision modifiers or bake where necessary; verify material/mesh counts in the output, not just polygon totals.

## 4. Atlas and material batching process

Bake only after comparison screenshots approve the source materials. Use **one UV atlas per material family or instanced asset group**, not a single giant 8K atlas for the island. Bake color, normal and ORM channels to compatible atlas layouts; save the source `.blend` and map provenance. For a browser-facing asset, test 1024² first, raise to 2048² only if close-ups demonstrate a benefit. LOD2 foliage often needs an alpha-cutout card rather than more texel detail.

A texture atlas reduces material switches only when geometry and material assignments are consolidated or instanced appropriately. The GLB preflight checks active LOD0 primitives, materials, LOD monotonicity, rock collision budgets, embedded textures, file size and missing decoder setup; it does **not** prove draw-call reduction, texture memory, or frame rate. Current default prototype gates (adjust after profiling) are: **16 MiB** GLB, **80k** LOD0 triangles, **48** LOD0 primitives, **24** LOD0 materials, **600** triangles per rock collider.

## 5. Acceptance before gameplay/production promotion

1. Blender: inspect base scene, generated LODs and each rock collision proxy in solid and material preview. Check source-file licenses, map alignment, correct normals and transparency sorting.
2. Node preflight: run the commands above; retain JSON report and attach it to the environment PR.
3. Runtime integration PR (separate work): load a staged asset behind a **disabled-by-default** quality flag, select one LOD and preserve analytic/static physics collisions. Validate against PR #172 natural habitats/rocks, avoiding duplicates.
4. Game gates: from `game/`, run `npm ci`, `npm run check`, `npm test`, `npm run build`. Run applicable exact-head CI workflows; don't weaken failing assertions.
5. Capture genuine MacArthur Bridge, Blue Heron, Lake Okonoka, shoreline and wooded paths on desktop High/Automatic/Smooth and compact phones, including 320×568 and 390×340. In co-op/race, verify no blocked routes, popping, disappearing rocks, WebGL errors or network asset aborts.
6. Compare startup payloads, draw calls, peak GPU memory, CPU/GPU p50/p95/p99 frametimes, and steady FPS against the **same camera routes on the production base**. A passing unit test cannot certify sustained 60 FPS.
7. Only then consider merging a validated asset/runtime PR. Publishing to `main`/Pages requires separate release approval and deployed-SHA verification.

## Tool/review references

- Existing world renderer: `game/src/belle/world.ts`
- Existing nature LOD: `game/src/belle/nature.ts`, `game/src/belle/vegetationLod.ts`
- Existing material layer: `game/src/belle/realisticMaterials.ts`
- Existing spatial/water layer: `game/src/belle/water.ts`, `game/src/belle/waterBanks.ts`
- Draft natural shoreline / geology work: PR #172 (keep separate pending validation)
- Blender glTF manual: https://docs.blender.org/manual/en/5.0/addons/import_export/scene_gltf2.html
- Three.js GLTFLoader/decoder requirements: https://threejs.org/docs/pages/GLTFLoader.html
- Sapling extension: https://extensions.blender.org/add-ons/sapling-tree-gen/
- Gscatter authoring: https://store.gscatter.com/assets
