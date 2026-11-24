# Belle Isle and Jefferson Avenue: geographic fidelity

## Implemented scope

This change adds **data acquisition, geographic intake, and an audit of the existing map**. It prepares the next modeling pass. It does not claim that the island or corridor has been rebuilt, surveyed, rendered with new assets, or deployed.

The tools run outside the game. They do not change the live renderer, roads, collision, GPS placement, vehicle behavior, quality settings, or frame pacing. No new runtime dependency is introduced. The existing desktop-performance repair remains a separate release requirement.

The baseline inspected here is repository commit `2a8901996e53b1f93474f3c2165e078b6dd16e57`. Exact input and analysis-code hashes are in [the baseline report](qa/geographic-fidelity-baseline-2a890199.json). Re-run the audit when map inputs change; a successful audit means that the inventory ran, not that geographic accuracy passed.

## What the existing map actually contains

| Finding | Meaning for the next visual pass |
| --- | --- |
| 1,201 park-map road records and 275 connected-district road records | Existing mapped alignments provide a useful starting point. Counts are records, not distinct physical streets. |
| 276 park-map and 608 district building records | Most of the work is improving the attributes and architecture of existing envelopes, plus filling documented omissions. |
| 47 added City building footprints all use 6.8 m | `build-mainland.mjs` assigns this default. These heights need building-specific evidence. |
| 444 road records differ from their recorded `sourceWidth`, by up to 3.4 m | Widths have been adjusted for cruising clearance. The recorded source width can itself be imported or inferred. A realistic-width migration must update visual edges, collision, route clearance and vehicle tests together. |
| 165 municipal road records receive widths of 8, 10 or 14 m | The current generator assigns these by street name. A centerline dataset does not supply surveyed curb positions. |
| 884 building records lack per-feature height evidence | This is missing provenance, not proof that every height was invented. Preserve plausible existing values as estimates until verified. |
| Elmwood terrain is a 109 × 136 grid at 8 m spacing | It is resampled into the existing game-relative vertical frame. Jefferson mainland remains a separate flat surface. |
| Current projection and WGS84 ENU differ by up to approximately 6.2 m over sampled park vertices | This is a mathematical model comparison using reconstructed geographic coordinates, **not a measured positional error**. Do not shift objects by these values. |

The existing frame is east/up/south, using the geographic origin longitude `-83.00175`, latitude `42.34680`. Horizontal positions use `111320` metres per degree and a cosine longitude scale. The river is at game height 0 and the island reference at 2 m. Those are not documented NAVD88 or ellipsoidal elevations.

The audit samples existing vertices, including repeated polygon endpoints. It is not a uniform spatial sample, an independent survey, or a tolerance certificate. An internally consistent round trip cannot establish real-world accuracy.

### Actual source acquisition

On November 24, 2026, the tools acquired and successfully staged **187 City building footprints, 140 City street segments and 160 SEMCOG building records** in the Jefferson work area. The complete returned feature-ID sets, raw source pages and source hashes were retained. These are overlapping source datasets; their record counts must not be added to claim distinct buildings.

All 47 City-derived building records already in the game had matching identifiers in the City snapshot. There are 151 unambiguous City-to-SEMCOG attribute-ID correspondences. Seventeen City records have no join ID and nineteen do not match the bounded SEMCOG snapshot. Matching an ID does not prove coincident geometry or agreement between acquisition dates. The 156 non-null SEMCOG median-height values remain raw attributes with unresolved units and are not applied to game heights.

This confirms that the existing City footprint layer is a useful foundation; building-specific heights and architecture remain missing evidence for those records. The new source snapshots are retained separately from the public runtime and are not shipped as new production geometry. Acquisition results and checksums are recorded in [the capture receipt](qa/geographic-source-acquisition-20261124.json).

## Review of the supplied recording

The 31-minute 32-second recording provides useful composition references:

| Video time | Priority |
| --- | --- |
| 01:30–03:00, Jefferson bridge approach | Building height and setback, roadway edges, street furniture, planting rhythm and block identity. |
| 10:00, Conservatory | Preserve the recognizable silhouette while checking the grounds, paths, adjoining volumes and planting beds. |
| 19:00, MacArthur Bridge | Verify deck profile, approaches, lane layout, railing rhythm and skyline alignment from a fixed camera. |
| 31:30, Boat Club waterfront | Compare the straight edge, bank treatment, rocks and docks against real shoreline/seawall evidence. A straight waterfront edge can be correct. |

The video is heavily compressed. Its encoded 30 fps and visible blockiness do not establish game frame rate or source texture quality. There is no usable build stamp or performance overlay. These observations identify what to inspect, not measured geographic discrepancies.

## Run the tools

Run from `lottominded-ultra.io/games/gothtechnology2/greater-detroit-world` with Node 22.16 or later.

```sh
npm test
npm run audit:geography
node tools/audit-geography.mjs --out /absolute/path/new-geographic-audit.json
```

The audit refuses to overwrite an existing output. It identifies exact map and analysis files by SHA-256 and rejects an unexpected origin, axes, malformed grid or invalid numeric values.

### Acquire a bounded source snapshot

The public ArcGIS acquisition tool uses a source registry. The planned first comparison area is the existing Jefferson gap, west/south/east/north `-83.016,42.339,-82.996,42.349`; it is an engineering work area, not an assertion of surveyed project boundaries.

```sh
node tools/fetch-geographic-source.mjs --source detroit-buildings --bbox -83.016,42.339,-82.996,42.349 --out-dir /absolute/path/new-jefferson-source
```

Acquisition reads layer metadata and independently obtains matching feature IDs, then fetches bounded batches. It verifies the complete identifier set. Source errors, duplicate IDs, transfer limits, missing records and unexpected returned coordinate systems are failures. A new output directory preserves the snapshot without replacing earlier evidence. The source registry also provides `detroit-streets` and `semcog-buildings`.

The current Detroit Base Unit street layer differs from the older `Detroit_Street_Centerline_Map` layer used by the game's generator. Compare them as separate source versions; do not substitute one silently or equate their identifiers.

### Stage a snapshot for modeling

```sh
node tools/geographic-intake.mjs --input /absolute/path/new-jefferson-source/features.geojson --manifest /absolute/path/new-jefferson-source/source-manifest.json --out /absolute/path/new-jefferson-source/staged-package.json
```

Intake accepts Point, MultiPoint, LineString, MultiLineString, Polygon and MultiPolygon. It preserves source geometry, properties, feature IDs, polygon holes and separate parts. It checks coordinate ranges, source count, optional independent ID membership, ring closure, basic degeneracy and ring self-intersections. Full GIS topology, ground alignment and visual correctness remain separate checks.

The horizontal input contract is WGS84 longitude/latitude (`OGC:CRS84`). Projected input must be explicitly transformed before intake. A supplied manifest records source attribution, retrieval time, known acquisition date, rights status and coordinate units. The acquisition tool supplies this manifest for its registered sources; hand-prepared data must provide the same contract.

Staging evaluates horizontal coordinates on the WGS84 ellipsoid at zero ellipsoidal height and outputs local east/south metres. It keeps source elevations in a separate array and converts only their declared units. International feet and US survey feet are distinct. A third coordinate requires a declared vertical datum and unit; unknown building-height attributes remain raw attributes. The output never treats a story count or an unlabelled `median_hgt` value as a measured metre height.

Standard [RFC 7946](https://www.rfc-editor.org/rfc/rfc7946#section-4) 3D GeoJSON uses WGS84 ellipsoidal heights in metres. An explicitly declared source Z in NAVD88 or feet is a project-specific staging convention carried by the manifest, not a claim that such input follows the standard 3D convention. Interchange it only with tools that understand that declaration.

Every staged package explicitly retains `productionReady: false`, `requiresTerrainDatumAlignment: true` and `requiresTopologyReview: true`. This format is an intermediate engineering package, not a GLB, terrain mesh, or automatic production import.

## Verified sources and practical limits

The machine-readable [source catalog](data/geographic-sources.json) records exact endpoints, metadata links and remaining uncertainties.

| Source | Useful data | Limit that matters here |
| --- | --- | --- |
| City of Detroit Base Unit Buildings | Footprints, building IDs, SEMCOG join IDs | The checked layer has no height or story field. Its redistribution terms were not established from the empty license field. |
| City of Detroit street layers | Street-segment geometry and names | Centerlines do not establish curbs, width, slope or a bridge deck. |
| SEMCOG Buildings 2024 | Footprints, stories, construction year and raw `median_hgt` | Height units are not established by the checked attribute metadata. The geometry being in feet does not settle that question. Custom reuse and attribution terms apply. |
| USGS/NOAA Wayne County 2017 DEM | Hydro-flattened bare-earth elevation, 2-foot source grid | Capture is April 2017. It is ground, not roofs, bridge decks, canopy or bathymetry. Inspect the delivered raster's datum and units. |
| NOAA-distributed Wayne lidar | Point cloud for independently checked roof/canopy derivation | Delivered coordinates can differ from the original project metadata. Inspect LAS metadata; a high return can be a tree or noise. |
| NAIP | Broad land-cover and terrain-color reference | Select actual scenes and read their date/resolution. It does not provide street-level facade detail. |
| Original or permissioned photographs/scans | Local facades, roofs, trims, materials and street detail | Capture scale, location, date and reuse rights. Camera GPS alone is not survey control. |

Primary references: [City Buildings](https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/BaseUnitFeatures/FeatureServer/2), [SEMCOG Buildings](https://gis.semcog.org/server/rest/services/Hosted/Buildings_2024/FeatureServer/2), [Wayne DEM metadata](https://www.fisheries.noaa.gov/inport/item/80495/full-list), [USGS 3DEP](https://www.usgs.gov/3d-elevation-program).

## Corrections to the proposed asset workflow

**Earth Studio:** its documented 3D export is camera/tracking data for compositing. It is not a terrain/building-mesh export. Google's guidelines prohibit reconstructing models from Earth/Earth Studio output and extracting Street View screenshots for separate use. The game asset pipeline should use separately reusable GIS, scans and photographs. See [camera export](https://earth.google.com/studio/docs/advanced-features/3d-camera-export/) and [Geo Guidelines](https://about.google/brand-resource-center/products-and-services/geo-guidelines/).

**Substance Sampler:** Image to Material generates channels through learned or procedural inference. Those maps still need scale, lighting and material calibration. A single facade photograph does not measure exact relief or roughness. See [Adobe's documented algorithms](https://experienceleague.adobe.com/en/docs/substance-3d-sampler/using/filters/tools/image-to-material).

**BlenderGIS:** preserve a local scene origin plus the full projected/geographic reference. Importing a map does not create missing accuracy, elevations or tree locations. A suitable local projection and documented datum transform are required for authoring. See [BlenderGIS georeferencing](https://github.com/domlysz/BlenderGIS/wiki/Georeferencing-management). The offline ENU helper here is a coordinate conversion, not a replacement for a full datum/epoch transformation. See [PROJ's topocentric definition](https://proj.org/en/stable/operations/conversions/topocentric.html).

**Unreal:** a native Unreal edition could reuse licensed master assets, but it is a separate runtime and delivery project. Lumen has platform and performance requirements; Pixel Streaming runs the application on a remote machine and streams frames/input. Neither is a drop-in change to the present Three.js browser game. See [Lumen](https://dev.epicgames.com/documentation/en-us/unreal-engine/lumen-technical-details-in-unreal-engine) and [Pixel Streaming](https://dev.epicgames.com/documentation/en-us/unreal-engine/overview-of-pixel-streaming-in-unreal-engine).

## Production sequence

### 1. Establish the common geographic frame

Choose independently verified control locations across the first corridor and both bridge approaches. Record horizontal uncertainty, source date, datum and any transformation. Define a target tolerance appropriate to the actual source quality, then measure residuals. No fixed precision is claimed before those checks.

Keep an original copy of every source. Resolve units and vertical systems before fitting terrain. Ground, bridge deck, road deck, water surface and canopy are different surfaces. The game river zero needs a documented relationship to the chosen elevation datum; a DEM's orthometric height must not be fed directly into an ellipsoidal-height calculation.

A coordinate migration must rebuild all affected layers together: visual geometry, collision, navigation, vegetation placement, race gates, saved poses and GPS mapping. The existing legacy transform remains available for comparison and migration tooling.

### 2. Rebuild the Jefferson–MacArthur first section

Start with recognizable dimensions: building footprint and height, roof silhouette, facade setbacks, actual road edges, bridge approaches and skyline alignment. Replace default-height extrusions only when a building-specific measurement or explicitly recorded estimate is available.

Build reusable window bays, brick modules, stone trims, cornices, industrial glazing and roof details from the actual buildings in the selected block. Do not impose one Art Deco or industrial style on the entire corridor. Each building retains its own observed shape and facade arrangement.

### 3. Produce PBR materials and local detail

Use original or suitably licensed photographs with a scale reference. Correct perspective, remove baked illumination, and calibrate albedo/roughness/normal strength against neutral lighting. Brick spacing should remain physically consistent across assets.

Author water-runoff masks, mortar variation, concrete staining, curb wear and a small decal atlas from observed conditions. Share materials and atlases across modules to control draw calls and shader variants. Prioritize silhouette at riding distance and surface detail at pedestrian distance. Never describe lossless asset packing as permission to discard visual detail; geometry reduction is a separate, visually reviewed operation.

### 4. Match light and atmosphere

Record reference date, local time and timezone (`America/Detroit`), camera heading, true-north orientation, focal length, exposure and weather. Sun position alone cannot reproduce clouds or camera exposure. Keep daytime reference captures stable while matching materials and silhouettes.

Tune river haze and distance fog after the base scene matches. Evaluate any volumetric pass against actual GPU measurements. Keep film grain and chromatic aberration optional for cinematic/photo output so the ordinary riding view and HUD stay clear.

### 5. Verify the playable result

Use fixed-camera comparisons at the Jefferson approach, MacArthur deck/landing, Conservatory grounds and Boat Club waterfront. Check scale and placement before grading the image. Compare silhouettes, lane layout, curbs, ground contact and tree locations against dated source evidence.

Keep the current collision, real-input, native performance and compact/mobile acceptance requirements. The active performance release requires p95 frame intervals at or below 50 ms and no intervals above 250 ms in its prescribed runs; those are acceptance gates, not proof of the broader 60 FPS desktop goal. New geometry and effects need fresh measurements on their own exact build. A compressed user recording cannot substitute for them.

## Inputs still needed for an accurate visual reconstruction

The next asset-authoring pass needs a reusable, building-specific facade/roof reference set or original scan files, independent control locations, verified roof-height units/measurements, selected ground tiles, and a measured relationship between those elevations and the game world. These tools make those inputs traceable and testable. They do not create the missing measurements or complete the detailed scene automatically.
