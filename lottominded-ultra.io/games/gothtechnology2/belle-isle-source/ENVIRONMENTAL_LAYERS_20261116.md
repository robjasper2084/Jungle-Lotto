# Belle Isle Explorer — habitat and geological environment pass

**Status:** Review candidate on a separate branch based on production `514f2051703a24bdac2e347ccd0dd18f6837b4c1`. Not published.
**Independence:** Separate from PR #171 (conservatory, curbs, atmosphere) to preserve that draft and its visual review.

## Implemented
- **Canopy / micro-habitats:** Existing mapped maple, willow, birch and pine assets gain deterministic 42-m-scale patches of varied foliage density, height, width and tint. Riparian, flatwoods, forest-edge and upland crown profiles retain every tree root, existing LOD/batching budget, season and shadow treatment. The near/far instancing receives the same per-tree density data, rather than new meshes/draw calls.
- **Paths:** Existing concrete, paver, timber and gravel PBR surfaces gain subtle world-coordinate weathering. Gravel transitions organically into compressed earth. Anti-aliased detail and unchanged route geometry prevent tiling seams and protect asphalt/racing.
- **Natural shoreline:** A single batched PBR sediment layer follows mapped river, island and lagoon edges. Elevation/strip bands grade dry sand and earth to damp mud and mineral sediment. No terrain height, waterline collision, beaches or engineered seawalls are changed.
- **Rocks and collision:** Three small low-poly mineral shapes have deterministic coloration, lichen/micro-fracture and variable scale. Bounded clusters are placed in mapped woods and dry shoreline focal points. Each boulder is kept at least 9m beyond mapped road/trail widths plus its own radius, and blocked from buildings, facilities and monuments. Ground riders, camera and flight obstacle rays all share the same always-on boulder colliders independent of quality.
- **Atmospheric coherence:** New materials use existing Three.js PBR color space, scene lights, fog and exposure; no new full-screen pass, texture URL or shadow caster is added.

## No promises outside evidence
- Planting is an art-directed distribution, not a botanical survey or claim about exact species at exact positions.
- Procedural rock meshes are low-poly gameplay assets, not photogrammetric scans.
- The scene is not yet FPS-certified. This branch must not be promoted without the actual CI and gameplay evidence.

## Acceptance gates
1. `npm run check && npm test && npm run build` on the exact commit; all nine required PR workflows, not only unit tests.
2. Compare real Chrome desktop/mobile visual screenshots in Smooth/Automatic/High including two-player co-op and distant scene silhouettes; reject missing trees, shader errors, blank previews and camera clipping.
3. Visit mapped wooded paths, beach, lagoon edges, waterline, and boulder clearances; verify no road/race blockage, no hover/Jetson collision regression, no submerged floating rocks.
4. Check that deferred scenery and seasonal variants retain correct visual quality; compare density, textures, alpha clipping, draw calls, p95/p99 and first-playable load vs the current published build.
5. Reconcile PR #171's separate conservatory/atmosphere/curb changes before any combined release.
6. Only after explicit promotion approval, merge and validate exact production Pages build/deploy and public desktop + phone browser checks.
