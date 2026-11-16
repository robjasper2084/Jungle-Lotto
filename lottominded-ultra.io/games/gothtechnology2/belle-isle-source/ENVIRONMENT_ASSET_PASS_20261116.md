# Belle Isle Explorer — Environment asset staging pass (16 November 2026)

## Scope and release status

**Status: isolated authoring / preflight candidate; not merged, not deployed.**
This pass adds Blender glTF staging and security/performance checks without
altering any world geometry, current foliage assets, water rendering, collision
volumes, routes, startup manifest, vehicle models or production asset pins.
It does not claim a new visually verified bridge, shoreline, water, or rock model.

**Existing source context:** browser world/bridge in `game/src/belle/world.ts`,
instanced tree models in `game/src/belle/nature.ts`, LOD treatment in
`game/src/belle/vegetationLod.ts`, water rendering in `game/src/belle/water.ts`,
and existing landscape materials in `game/src/belle/realisticMaterials.ts`.
Pending natural habitat + rocks PR #172 is independent and must not be
replaced, rebased, cherry-picked or merged as part of this tooling-only pass.

## Delivered in this branch

1. `tools/export-belle-environment.py` — Blender selected-only asset copier
   with 3 render LODs per tagged source and an independent bounded low-poly
   collider for rocks, plus local JSON source audit; requires a Blender process.
2. `tools/validate-belle-asset-pack.mjs` — offline GLB verification of glTF
   framing, compressed-extension compatibility, assets/roles/LOD integrity,
   draw/material/triangle budgets, external URI rejection, and rock colliders.
3. `tools/validate-belle-asset-pack.test.mjs` — automatic positive/negative
   validations; `game/npm test` includes the new tests.
4. `.github/workflows/belle-blender-assets.yml` — dedicated non-deploying PR
   preflight for Node validation and Python syntax.
5. Candidate CC0 source manifest and the detailed Blender asset workflow.

## Artist handoff: creating actual geometry

Use the **existing** Belle Isle Blender source scene or a copy, tag approved
mesh objects with `belle_export=True` and `belle_role=bridge`, `tree`/`foliage`,
`waterbed`/`shore`, or `rock`. Generate a mixed interchange pack with:

```bash
cd lottominded-ultra.io/games/gothtechnology2/belle-isle-source
blender -b /path/to/reviewed-environment.blend --python tools/export-belle-environment.py -- \
  --output game/output/belle-blender/belle-environment.glb
node tools/validate-belle-asset-pack.mjs game/output/belle-blender/belle-environment.glb \
  --require-families=bridge,foliage,water,rock
```

The `water` family represents **waterbed/shoreline meshes**, not the animated
water shader. New render meshes are not automatically live, and the whole
GLB must **not** be inserted as one visible Three.js scene; that would render
LOD1/2 and colliders simultaneously. Never overwrite pinned GLBs from this
unreviewed staging output. Blender-generated geometry, actual visual review,
physical-phone FPS and screenshot acceptance are **not complete** until
someone runs this Blender stage with approved sources.

## Next gates before an asset/runtime PR or production release

- Collect asset source URLs, CC0/approved licenses, PBR map hashes and
  real island references; verify scale, location, normals and silhouettes.
- Run Blender 4.5+/5.x export; review sidecar triangles, near/far LODs,
  opaque/cutout vegetation and rock collider bounds.
- Stage only explicitly reviewed GLB families behind an off-by-default
  runtime selector. Reuse `ParkTerrain` collision primitives and route clearances;
  avoid overlapping PR #172 boulders and tree instances.
- From game/: `npm ci`, `npm run check`, `npm test`, `npm run build` plus
  all exact-head release workflows. Never weaken assertions.
- Compare identical routes/quality settings at bridge, wooded canals, Blue
  Heron, Lake Okonoka and beach shoreline on desktop/phone and co-op.
  Inspect real screenshots, asset-transfer aborts, texture/geometry budgets,
  p50/p95/p99 frame time, memory, draw calls and 320x568 + 390x340 HUD.
- Hold merge to `main`, Pages publication and production-sha verification
  until full checks, human visual acceptance and explicit production approval.
