# Jefferson placement source audit

## Scope and status

This record selects two existing Jefferson Avenue building IDs for original fictional presentation skins and two slender street signs. The explicit assignments and native-route planning coordinates are in `src/belle/jeffersonPlacements.ts`. The corresponding adapter is responsible for validating the actual loaded asset and publishing it only after the existing warmup transaction succeeds.

**Status: source placement and actual exported geometry checks complete; actual-game visual review and the unchanged desktop/phone performance checks remain pending.** This document does not certify a real building survey, a native route, a screenshot, or a release. The strings named `reviewedReference` retain that existing loader field name but explicitly say “visual review pending.”

The assignment-specific model is `public/belle/jefferson/models/Jefferson_Assigned_Buildings.glb`. Its expected roots are `JEF_detroit_38139` and `JEF_886253052`. The source archetypes remain `SunsetBlock4` and `SunsetBlock1` respectively. The runtime `Jefferson_Assigned_Street.glb` contains exactly the two selected sign roots at their authored metre dimensions, extracted from the larger source `Jefferson_Street_Kit.glb`.

## Source and coordinate frame

The audit uses the fresh isolated candidate based on main commit `893f769838166e6e35624b7b979ed5cbb8414507`, with implementation on the local `upgrade-redesign` branch. It does not use the separately owned performance-repair worktrees.

| Source | SHA-256 |
| --- | --- |
| `public/belle/map.json` | `eb36e093fc477055c217025668403fc5d2c422bfdc9d9021769192dbb5660d87` |
| `src/belle/detroitDistricts.json` | `4006a1c523b08a5403f7101a45bd9f739c4aa4632d55a1be5c3676148cde0bdf` |

The game uses metres with x east, y up, and z south. The mapped longitude/latitude origin is `[-83.00175, 42.34680]`. The two selected buildings are district records, not park records. There are 276 park building records and 608 district building records, with no shared IDs between the two datasets at this source revision.

Source checks instantiated the real `ParkTerrain` with connected districts enabled after applying the same `alignScottMap` and `prepareCoastGuardMap` mutations used during boot. That instance had 855 collision boxes. Prop clearance was checked against all 1,476 road/path records from both datasets. The original terrain height is 2 m at both selected buildings, all three camera targets, and both signs.

## Building assignments

| Existing building ID | Adapted root / original archetype | Existing fit center x, z (m) | Existing fit w × d × h (m) | Existing yaw (rad) | Additional yaw |
| --- | --- | --- | --- | --- | --- |
| `detroit-38139` | `JEF_detroit_38139` / `SunsetBlock4` | −757.1795249305, 426.1148216943 | 22.4016002661 × 17.7591561976 × 6.8 | −2.6173879483 | 0 |
| `886253052` | `JEF_886253052` / `SunsetBlock1` | −1955.355, 1052.185 | 20.7362637329 × 17.8891466024 × 9.9 | 0.5216088746 | 0 |

`fitStreetBuilding` provides these transforms. The exact floating-point values and source polygons are retained in `JEFFERSON_BUILDING_SOURCE_AUDIT`; that audit export is provenance only and must never replace the active map or collision geometry.

The workshop uses the fictional **DIGITAL STATIC** design. Its original authored total dimensions are approximately 22.43 × 15.62 × 6.74 m, so the existing 6.8 m map height is compatible with the single-storey design. The selected workshop has small concave footprint details. A simple normalized rectangular asset is insufficient to prove containment; the assignment-specific mesh must follow the actual footprint.

The market uses the fictional **RIVERFRONT MARKET** design. Its source has three storeys and total authored height 12.24 m, including the roof details. Preserving the existing 9.9 m map height gives a baseline vertical scale of approximately 0.808824. The authored floor divisions of 4.0, 3.5, and 3.5 m become approximately 3.235, 2.831, and 2.831 m. The authored 2.7 m door becomes approximately 2.184 m. These proportions support a plausible fictional three-storey storefront without increasing the mapped height. The final adapted asset still requires visual inspection.

Nearby taller records were considered rather than compressing a four- or five-storey design into a low block. Records `59422941`, `868843430`, and `957898908` have incompatible large footprints, proportions, or heights for the supplied archetypes. Record `985910914` has a useful three-storey size but its fitted front is nearly perpendicular to Jefferson; using it would require a quarter-turn outside this pair's unchanged-fit and 0/π frontage rule. The selected market provides variation while preserving the existing scale and frontage.

### Original footprints

`detroit-38139`, height 6.8 m:

```json
[[-742.77,428.25],[-761.45,439.05],[-763.92,434.82],[-764.99,435.37],[-769.02,428.47],[-767.95,427.91],[-770.5,423.35],[-751.82,412.55],[-742.77,428.25]]
```

`886253052`, height `9.899999999999999` m:

```json
[[-1969.07,1049.54],[-1950.73,1039],[-1941.64,1054.83],[-1959.98,1065.37],[-1969.07,1049.54]]
```

### Frontage calculation

The authored fronts face glTF +Z. After the existing fit yaw, their horizontal direction is `[sin(yaw), cos(yaw)]`. The nearest point on the closest Jefferson segment provides the comparison direction from the building center toward the road. Choose an additional yaw of 0 or π by the sign of that dot product.

| Building | Jefferson road record | Segment endpoints x,z | Closest point x,z | Center distance | Front dot product |
| --- | --- | --- | --- | --- | --- |
| `detroit-38139` | `city-35309`, width 14 m | [−887.06,468.23] → [−683.05,349.57] | [−771.7077395538,401.1367240599] | 28.8959232691 m | 0.9999966096 |
| `886253052` | `city-34922`, width 14 m | [−2000.7,1116.49] → [−1878.91,1045.75] | [−1938.8654802931,1080.5742932584] | 32.8307208552 m | 0.9999894193 |

Both fronts already face Jefferson, so both assignments use `yawOffset: 0`. The adapted roots are authored for these exact transforms. Their ground anchor must match `terrain.height(...originalBuilding.points[0])`; the previous visual-only −0.05 m offset must not be applied to these two adapted roots.

## Slender sign placements

| Placement | Root | x, z (m) | Yaw (rad) | Nearest Jefferson road | Minimum residual road/path margin |
| --- | --- | --- | --- | --- | --- |
| Workshop wayfinding | `JEF_BelleIsleWayfinding` | −758.759, 407.487 | −2.6147839346 | `city-35309` | 3.1896124210 m |
| Market street sign | `JEF_JeffersonStreetSign` | −1951.810, 1074.216 | 0.5262090269 | `city-34922` | 3.1896257918 m |

Both signs are on mapped land at terrain height 2 m. A conservative horizontal radius of 1.01 m covers either sign's geometry. The actual terrain obstruction query returned false with that radius plus a 0.25 m obstacle buffer. The road/path check used every segment in both datasets and calculated:

```text
residual margin = distance to segment − road.width / 2 − 1.01 m − 0.8 m
```

The positive minimum values above leave the signs clear of all mapped road and path corridors under this conservative test. The adapter repeats clearance checks against the actual loaded sign bounds. These are presentation-only signs with `collisionPolicy: 'visual-only'`; they do not add new collision registrations. Real-game inspection must still check visibility and perceived placement.

## Native capture route plan

`JEFFERSON_CAMERA_TARGETS` contains three targets, their intended look-at centers, fitted dimensions, headings, and full route arrays. These values are navigation hints only. The gallery driver must use normal input and the existing visible Guide action; it must not set the player position or camera state directly.

The `signLookAt` points are measured from the bounds of the actual exported lettering vertices, including the 2 m terrain ground height. DIGITAL STATIC is at `[-766.9314639486762, 6.869166135787964, 421.3020398826117]`; RIVERFRONT MARKET is at `[-1952.6480470046893, 4.87523481696844, 1061.1167630426794]`. The workshop measurement isolates the `JEF_StaticGold` glyphs above local 4 m to exclude door handles; the market uses `JEF_LetteringIvory`. These values guide native sign framing and do not directly assign camera state.

| Target | Planning point x,z | Native route start | Planned route length | Source samples |
| --- | --- | --- | --- | --- |
| `jefferson-workshop-wide` | −823.572698, 431.303363 | Default spawn [0,0] | 942.5525 m | 3,794 |
| `jefferson-market-front` | −1938.865480, 1080.574293 | Guide: Dequindre Cut at East Jefferson | 291.9984 m | 1,177 |
| `jefferson-market-wide` | −1990.748520, 1110.709824 | Guide: Dequindre Cut at East Jefferson | 231.9984 m | 937 |

The workshop route follows `districts.routes.cut` from its near-spawn section along Jefferson. The market routes begin at the normal Guide destination `districts.cut = [-2181.05,1221.65]` and reverse the existing route along Jefferson. The two wide views are 60 m west along the corresponding road tangent from the perpendicular front point, allowing a wider portrait framing candidate. The market front view is intended for storefront lettering.

Each planned segment was sampled at intervals no larger than 0.25 m using the real source terrain. Every sample was on land and returned false for `terrain.obstructed(x,z,0.6)`. Maximum sampled slope was zero. These are static source checks, not native movement tests; dynamic scenery, movement stopping distance, camera behavior, and real screenshot framing remain to be checked in the running game.

Terrain camera rays from nominal eye height 1.7 m above each planning point toward the selected building's mid-height first reached within 0.115 m of the selected footprint boundary. This is consistent with the target collider and its ray margin, rather than a separate intervening mapped building. It does not establish legibility, full facade visibility, or the final camera composition.

## Actual exported geometry validation

The final runtime bytes passed all six tests in `src/belle/jeffersonAssetFiles.test.mjs` with pure Node and no browser/image DOM. The command was:

```sh
node --experimental-strip-types --test src/belle/jeffersonAssetFiles.test.mjs
```

| Runtime file | Runtime SHA-256 | Material batches | Triangles |
| --- | --- | --- | --- |
| `Jefferson_Assigned_Buildings.glb` | `929e7574f4cce443a3c2378b20000bbe4bef2a1bb5b2321f56c0c999ece5a3a4` | 17 | 13,168 |
| `Jefferson_Assigned_Street.glb` | `67a05f0a60a0b751632d1b1a70afc5f89592d961a448b0e04e9862213c876600` | 6 | 1,660 |

The source GLBs embed their PNGs. Runtime packaging externalizes those exact PNG bytes into twelve shared files named `textures/<sha256>.png`, referenced only through `../textures/<sha256>.png`. This lossless packaging keeps individual transport payloads small without resizing, recompressing, or changing the textures, geometry, or materials.

| Source file | Approved embedded-source SHA-256 | Source bytes | Runtime GLB bytes |
| --- | --- | --- | --- |
| `Jefferson_Assigned_Buildings.glb` | `94390122fc6f8940b49e6d0d23b303a19869610912a7658739cdd38f32c72625` | 14,182,112 | 894,508 |
| `Jefferson_Assigned_Street.glb` | `0986558a3e0fc15ffad4835efae399c52ccd022ae9455791572723dc8af48207` | 2,526,960 | 79,504 |

`public/belle/jefferson/manifest.json` records both identities, every original image's source buffer provenance, every retained geometry buffer view's hash, and the exact runtime PNG paths, byte lengths, hashes, and dimensions. Its SHA-256 is `5e68b2fc0a9a8c6481b4b24506240b0f97b7f8292d7f0d137357464ea3dbce78`. The twelve shared PNGs total 13,287,694 bytes. The packaging step compared every source image and retained buffer view byte for byte and checked that non-storage glTF structures remained unchanged after buffer-view index remapping.

The Node gate pins the two approved source identities, verifies each runtime GLB hash, recomputes every retained buffer-view hash, and checks every referenced PNG's exact SHA-256, byte length, and dimensions against the source/runtime manifest. It accepts only the fixed relative texture path pattern, rejects unlisted images and symlinks, and permits no remote URL or arbitrary path. Both runtime models must reference exactly the manifest's texture set.

The test reads the actual GLB JSON/BIN chunks and buffer accessors, applies the authored scene transforms and the real `fitStreetBuilding` matrices, and compares the root metadata with the current district records and placement audit. Both buildings retain their original ground and height. All transformed vertices stay inside the original source polygons within Float32 roundoff tolerance. Polygon clipping of every nondegenerate projected triangle found **0 m² outside the source footprint** for each building, including the concave workshop. The workshop has 6,097 exported vertices and 3,396 triangles; the market has 18,754 vertices and 9,772 triangles.

The same gate verifies finite UVs and unit normals, opaque PBR materials, required albedo/normal/ORM bindings, the checked local PNGs within the 1,024 px runtime budget, and the exact lettering-based `signLookAt` targets. The street payload contains only the two selected sign roots. Both retain their 2.89 m authored height and fit the 1.01 m conservative placement radius. Building budgets remain capped at 17 material batches and 14,000 triangles; sign budgets are capped at 6 batches and 2,000 triangles.

The final workshop export also removes a confirmed overlapping fascia surface. Its lettering coordinates and budget are unchanged. The geometric validation above was rerun against the repaired runtime file identified by the recorded hash; it is not evidence of a native in-game visual pass.

## Integration and remaining acceptance

Only the two literal building IDs may receive these skins. Preserve the existing fit center, dimensions, height, yaw, source map records, road data, and collision registrations. Assigned mesh validation must check the exact source polygon and fit metadata; the generic ±0.5 normalized-box rule alone cannot prove containment for the workshop. The offline adapted-mesh audit must also check triangles, since vertex checks alone are insufficient for arbitrary concave polygons.

Keep the original building fallback until the selected geometry, textures, and programs have all warmed successfully. A failed asset load, stale fit, invalid footprint, or warmup must leave the original presentation available. Selected textures must stay owned by the new assets and must not overwrite the shared city materials.

Before release, attach native desktop/phone screenshots for these targets and the unchanged 90-second desktop/phone results alongside the geometry validation above. Run the existing collision and full-scene gates without reducing their settings or thresholds. This placement audit does not mark any of those later checks as passed.
