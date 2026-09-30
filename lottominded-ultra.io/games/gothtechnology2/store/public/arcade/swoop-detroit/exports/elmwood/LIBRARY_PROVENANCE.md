# Elmwood Cemetery environment library

This is an editable, georeferenced environment and reference-based asset library for **Elmwood Cemetery in Detroit, Michigan**. It is a first reconstruction, with incomplete survey and architectural fidelity clearly recorded. It is not a photogrammetric replica of every grave, tree, or monument.

## Open the work

- `blender/Elmwood_Master.blend`: assembled metre-scale terrain, mapped paths, three principal building models, bridges, and estimated dressing.
- `blender/Elmwood_Asset_Library.blend`: twenty-two editable modular assets in a catalog layout.
- `blender/Flying_Geese_High_Low_Bake.blend`: 97,216-triangle high-detail source and 5,932-triangle target, with a 1024px tangent normal bake.
- `Unreal/Elmwood.uproject`: Unreal Engine 5.8 project with imported PBR materials and saved `/Game/Elmwood/Maps/Elmwood_Master` level. Lumen GI/reflections and virtual shadows are configured. Editor import and asset assignment are verified. A real-RHI viewport render was captured, but missing masonry faces and some actor orientations remain visible issues. Native gameplay has not been verified.
- Local browser review: `http://127.0.0.1:8198/elmwood.html`. The review supports orbiting, individual assets, estimated dressing visibility, season changes, solar time/date, and a map audit. It now includes Circuit hoodie/suit selection and Ride Elmwood with the original EUC controller. WASD/arrows move, Shift crouches, Space hops, R recovers and P pauses; Escape returns to review. The city and Elmwood remain separate pages.
- `fbx/`: individual engine-ready FBX assets and terrain foundation. Their matching GLBs, LOD1 models, textures and placement metadata are delivered under `runtime/` in the ZIP (located in `public/elmwood/` in the working project).
- `terrain/`: original-resolution cropped float GeoTIFF, 16-bit PNG and little-endian R16, georeferencing and hillshade audit.
- `ASSET_BUDGET.csv`: per-asset source/runtime vertices, triangles, LOD triangles, file bytes and conservative texture memory.

## Coordinates and heightfield

Origin: the centroid of OSM gatehouse footprint **313128810**, approximately **42.345036600, -83.017670800**. Its sampled source elevation is **183.2023 m**.

Source projection: **EPSG:26917, NAD83 / UTM zone 17N**, metres. Blender uses X east, Y grid north, Z up. GLB/browser uses X east, Y up, Z south. The installed Unreal FBX importer was checked against the terrain bounds: Unreal X east, Y south, Z up, centimetres. The coordinate conversion test had a 0.000014 m centre residual; this measures export consistency, not geographic accuracy.

The **MI_WayneCo_2017 USGS one-meter DEM**, published March 30, 2020, supplies the actual relief. The crop is **801 × 1033** samples with elevations **177.0046–190.2662 m**. Runtime terrain samples this at 2m spacing. No procedural hills were added. The source vertical datum is not encoded in the GeoTIFF CRS; consult project metadata before combining with a separate elevation datum or conducting survey work.

The PNG/R16 row order starts at the northwest corner. Decode `elevation = 177.0046234 + value/65535 × 13.2615814`. The runtime Z offset subtracts 183.2022858m. Use `terrain/georeference.json` for exact pixel bounds and transformation. Unity requires resampling to a supported terrain resolution; preserve the physical width and length rather than treating every imported pixel as one metre after resampling. No Unity editor scene was created or tested.

Three mapped bridge alignments have independent decks so their walkways do not follow the bare-earth creek bed. Deck heights and 5m approach transitions are estimates from nearby bank elevations. They require an actual bridge survey for precise reconstruction.

## References and provenance

- [Google Maps satellite reference](https://www.google.com/maps/@42.3491,-83.0195,1300m/data=!3m1!1e3).
- Google Maps contributor panorama inspected at `42.3491851,-83.0192936`, by **Jonathan Brandt**, captured **September 2014**. It visibly shows the chapel, curved roadway, monuments and mature trees. Its camera geotag differs from the mapped chapel footprint, so it was used for appearance, not coordinate calibration.
- [Elmwood official cemetery plan](https://www.elmwoodhistoriccemetery.org/images/elmwood_cemetery_map-1.pdf) and [official tree tours](https://www.elmwoodhistoriccemetery.org/events-tours/tours).
- [Official architectural history and gatehouse photography](https://www.elmwoodhistoriccemetery.org/foundation/history-of-elmwood-cemetery).
- [Official mausoleum description](https://www.elmwoodhistoriccemetery.org/cemetery-services/services).
- [Marshall M. Fredericks Sculpture Museum: Flying Wild Geese](https://omeka.svsu.edu/items/show/5103), including published cast dimensions of 43 × 43 × 27 inches. The sculpture model is an interpretation, not a scan. Museum photography remains a reference image.
- [Traugott Schmidt and other site photography by Erin Marie Miller](https://www.erinmariemiller.com/blog/2025/11/4/buried-history-elmwood-cemetery).
- [OpenStreetMap contributors](https://www.openstreetmap.org/copyright): full-site extract, relation **3823589**, downloaded September 15, 2026. OSM data is subject to ODbL.
- USGS source tile URLs are preserved in `references/dem-catalog.json`; the large original regional tiles remain in the working acquisition folder and are omitted from the delivery ZIP. The cropped full-resolution DEM is included.

The 18 PBR sets include Albedo, Normal, Roughness, Metallic and AO plus packed ORM. The realism pass uses CC0 photographic material analogues from Poly Haven (bark, asphalt, slate, sandstone, granite grain, woodland soil and wood) and ambientCG Grass004. These are not scans of Elmwood. Native maps are generally 2K, browser maps 1K except 2K limestone, with botanical leaf masks at lower resolutions. Generated Higgsfield weathered limestone is used for aged marker variants; its normal/roughness/AO are inferred. See `realism/photographic-material-sources.json` and `realism/higgsfield-provenance.json`. Google and official landmark photos remain visual references, not extracted game texture skins.

Grass004: https://ambientcg.com/view?id=Grass004 (CC0, https://docs.ambientcg.com/license/). Poly Haven: https://polyhaven.com/license.

## Visual fidelity check

Source renders are in `renders/`. The chapel was compared against the Google panorama; the gatehouse against official front and side photographs. Review found and corrected obscured chapel side windows, missing gatehouse window divisions, an empty default GLB scene, unassigned terrain materials, and bridge paths dipping into the bare-earth creek bed.

Outstanding discrepancies:

1. **Precise building and monument detail:** the chapel/gatehouse roof heights, hidden facades, intricate carvings and interior structures are estimated. Buhl and Schmidt models are studies with unverified dimensions; they are retained in the library without invented exact site coordinates. The 1895 public mausoleum and the complete statue collection have not been reconstructed individually.
2. **Incomplete site inventory:** two mapped building footprints remain unidentified. The extract lacks a mapped pond outline and individual tree/grave coordinates. The 228 trees and 4,532 grave/monument dressing instances are an estimated density study, with no fabricated personal inscriptions. Five species-specific leaf silhouettes now replace the single atlas; tree forms and seasonal behavior remain approximations. The realism pass adds 6,305 estimated grass, leaf, shrub and small-tree details.
3. **Google map alignment:** `Elmwood_Map_Audit.kml` was successfully opened in Google Earth's local KML editor over satellite imagery dated May 9, 2023. The 41 path segments, five building footprints and three water features were visually compared: the main curved road pattern and creek alignment follow the imagery. Canopy-covered segments and the missing pond outline remain unresolved. This was a qualitative overlay inspection, with no measured image-space alignment residual. See `google-overlay-audit.json`.
4. **Material and lighting accuracy:** browser materials are mostly 1024px (limestone 2048px) and repeat at close range. Weathering, metallic patina and normals are inferred. Browser, Blender and Unreal sunlight use the site's latitude and an approximate date/apparent-solar-time model. The saved native scenes use September 15, 2026 at 14:00 apparent solar time, with a calculated solar elevation of 41.73 degrees. Unreal imports flip the green channel of the OpenGL normal maps. Exposure and shadows have not been calibrated to a dated site photograph.
5. **Gameplay testing:** the Rapier audit samples 4,642 route positions with a rider-sized capsule and finds no building/trunk/monument intersections. The added dynamic audit drove the original electric-unicycle controller for three seconds along one eligible straight segment of 27 paths with no crashes. This is not a complete route traversal or native Unreal playtest.

## Performance and validation

Each modular asset has a LOD1 GLB. Shared albedo/normal/ORM sets have conservative RGBA8+mip-chain budgets calculated from each recorded resolution. See the updated `DELIVERY_SUMMARY.json` and `ASSET_BUDGET.csv`; 1024px sets use 16 MiB and 2048px sets use 64 MiB before engine compression. Repeated materials should be counted once; the CSV per-asset totals must not be added together to estimate scene residency. Actual BC/KTX2 engine compression can reduce this; it was not measured as GPU residency here.

The browser shares textures/materials and uses instanced meshes for repeated vegetation and grave modules. Leaf wind is a lightweight vertex shader; winter removes deciduous leaf cards while pine foliage remains. Unreal uses separate editable actors, so a later HISM/foliage conversion is advisable for production-scale performance. The saved level is an authoring scene, not a profiled shipping build.

Validation artifacts: `runtime/gltf-validation.json`, `runtime/collision-audit.json`, `unreal-final-validation.json`, `DELIVERY_SUMMARY.json`, and `ASSET_BUDGET.csv`. The glTF report is generated from the final optimized files, using glTF Transform and Khronos glTF Validator.

## Rebuild sequence

From the original project root: run `tools/fetch_elmwood_data.py`, download the catalogued DEM tiles, run `tools/build_elmwood_geodata.py` and `tools/create_elmwood_materials.py` with the task-local geospatial Python environment; then run Blender scripts `build_elmwood_assets.py`, `assemble_elmwood.py`, `bake_elmwood_monument.py` and render scripts. Run `optimize-elmwood.mjs`, `validate-elmwood-collision.mjs`, and `document_elmwood.py`. The Unreal Python commandlet executes `import_elmwood_unreal.py`, with `finalize_elmwood_unreal.py` for updated bridge/foundation validation. Source scripts are included under `tools/` in the ZIP.


## Realism pass status

The chapel now uses the projecting central front, lancets, door hood and buttresses shown in the official Elmwood_Chapel_3217 photograph. Its foundation is seated at the entrance grade. Gatehouse glazing/tracery, Buhl roof and arch forms, and Schmidt Ionic/bronze details were revised from reference photographs. `renders/elmwood-chapel-realism.png` and `renders/elmwood-gatehouse-realism.png` are the current Blender views; older review renders may predate these changes. The file `chapel-2014-reference.jpg` is a historical filename: its image actually depicts the gatehouse and must not be used as a chapel reference.

The existing `Digital_Static_Elmwood_Cemetery_Assets.zip` predates this realism pass. Current assets are in the working project. The wider reconstruction is still incomplete: no claim is made that every building, grave, statue or vegetation placement matches the site exactly. Native render discrepancies remain documented above.
