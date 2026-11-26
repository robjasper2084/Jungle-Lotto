# Jefferson corridor staging: actual game Armory integration

This is an **opt-in visual-only preview**, dependent on the verified [187-building game-map crosswalk](https://github.com/robjasper2084/Jungle-Lotto/pull/214). It is not a production acceptance or deploy.

## Actual verified disposition

- 187 City footprints from the bounded 2026-11-24 study
- 75 unique one-to-one candidate matches: 20 park map, 55 district map
- 84 without an overlapping existing game building candidate
- 28 with overlapping candidates below 0.80 intersection-over-union
- No competing assignments among the 75
- Armory City object 38712 matches original game object 59264442; IoU 0.920103

The 75 candidates are **not automatically replaced**. The 112 unresolved are not silently moved or generated, and their individual status remains in the crosswalk artifact. This first staged replacement covers the Armory only. Legacy collision persists for every building and remains the authoritative movement surface.

## Test the 3D model in the real game

Branch-only build with `VITE_STAGED_JEFFERSON_ARMORY=1`. Without that flag, the source and site behave as on main. The staged Armory loads only within 750 m. Its exact 2,764,484 original bytes are SHA-256 verified before GLTF parsing, texture upload and shader warmup. The existing Armory facades and roofs are isolated into a separate group in `serviceBuildings.ts`; they stay visible if any download, hash, decode, texture, shader or preparation step fails. Only after successful preparation are they removed from view. Other buildings' original mesh batches are untouched. All existing game collision, bridge, vehicle, UI, GPS, navigability and road geometry remain unchanged.

The model contains local Three.js LOD0/LOD1/LOD2 groups at 0/180/480 m, placed at game (347.303359,2,-198.411080) with no added rotation. The custom authored roof reaches approximately 16.3 m above its ground, compared with the old nominal 11.1 m collider. This **unresolved height difference makes flying collision acceptance mandatory before release**.

## Release blockers

1. Complete full source tests, TypeScript and lossless asset build.
2. Real browser matched-angle before/after captures near Jefferson and Baldwin; verify no duplicate facades, no missing roof, correct orientation and fit. Use the user's prior ride video as baseline only.
3. Walk, drive and flight collision sweeps; reconcile the 2.626 m footprint boundary and 5.2 m modeled-vs-collider height gap without silently altering collisions.
4. Full original native 90 s High desktop and Smooth phone viewport ride, p95 <=50 ms and zero frame intervals above 250 ms, unchanged input, quality and MSAA. Physical phone remains separately unverified.
5. Verify City-derived source terms, lidar height attribute units, and representative facade roof photography. Keep all unsurveyed dimensions as estimates.

Do not merge or deploy based on static viewer images or unit tests.
