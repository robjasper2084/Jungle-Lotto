# East Jefferson street and building candidate

This candidate extends the mapped East Jefferson corridor from East Grand Boulevard toward Woodward and adds recognizable architecture, traffic signals and public Guide street views. Source maps, historic records, photographs and operator aerials support different parts of the reconstruction; authored dimensions and unresolved source fields are identified below. The original crosswalk remains a record of spatial identity checks, while separate runtime modules supply the additive streets, building models and collision solids.

**Status: candidate under review in [PR #284](https://github.com/robjasper2084/Jungle-Lotto/pull/284).** Fresh native gallery and original sustained-performance acceptance are required for each revised runtime candidate. Offline Blender previews render the candidate meshes for architectural inspection. They are not captures of the running game and do not establish WebGL, gameplay, phone-device or performance acceptance. The existing canonical 90-second native performance workflow and its gates remain separate and unchanged.

## Current runtime scope

The candidate contains **six detailed landmarks**: five use their original game footprints, and Palms uses one of the **49 added context-building footprints**. The other 48 new footprints provide mapped surrounding massing; they are not claimed as photographically reconstructed facades.

| Detailed landmark | Runtime footprint | Visual interpretation and height basis |
| --- | --- | --- |
| Frederick Stearns Building, 6533 E Jefferson | Original `detroit-89989` | Four-story brick frontage and eight-story central addition. The 21 × 24 m addition is an aerial-informed model estimate wholly inside the original outline; 3.9 m story spacing is estimated. |
| Garden Court Apartments, 2900 E Jefferson | Original `868842406` | Nine stories, H-shaped outline, brick and limestone bands, projecting bays, balcony and balustrade. Wall and parapet dimensions are photo/story estimates. |
| John N. Bagley House, 2921 E Jefferson | Original `114282642` | Red masonry, pitched roof, corner turret and chimneys. Wall, roof and turret proportions are photo-informed estimates. |
| William H. Wells House, 2931 E Jefferson | Original `955779335` | Stone main house, steep hip roof, small mapped turret cap and curved-bay windows, with the broad viewer-right wing reduced to one story under a flat dark roof. Main walls 7.3 m, wing walls 3.65 m and roof rise 6.0 m are authored estimates. |
| Pasadena Apartments, 2170 E Jefferson | Original `957898908` | Eleven-story buff-brick apartment form, projecting bays, pale entrance/base and upper cornice. Identity and levels are independently supported by the original OSM record; model story spacing is estimated. |
| The Palms Apartments, 1001 E Jefferson | New `jefferson-city-8423552-0` | Six stories, limestone street facade and open courtyard. Overall 21.34 m height follows HAER's reported 70 feet; individual floor and parapet proportions are estimated. |

The Wells height partition uses existing source vertices `3…12` for the low wing and one internal chord `12→3`. Its 56.51745 m² low wing and 309.66945 m² main polygon exactly reconstruct the original 366.18690 m² outline, with zero overlapping area. Near and distant models preserve this height distinction; the steep main roof excludes the low wing. The geometry and photographic qualification are recorded in [wells-height-zones.json](wells-height-zones.json).

All six landmarks retain persistent inexpensive distant massing and upper roof silhouettes when their detailed facades are beyond the detail range. Nearby windows, trim, balconies, roof forms and procedural masonry use original modeled geometry. Reference photographs are inspected for likeness; third-party photo pixels and Street View panoramas are not installed as building textures. See [photographic-evidence.md](photographic-evidence.md) and [landmark-references.json](landmark-references.json).

The signal planner represents **all 13 source intersections** with **62 signal heads, 36 fixture assemblies and 28 spans**. City inventory coordinates establish intersection locations. Pole and head placement, support geometry, clearances and the deterministic red/amber/green cycle are authored game details, not surveyed fixtures or live municipal timing. The sourced parallel northern carriageway supplies the missing road support at the Chrysler west service-drive intersection.

The sidewalk correction uses SEMCOG's separately mapped sidewalk and crossing lines from East Grand Boulevard through Woodward. Source-width polygons add raised pavement, curb fascias and **171 qualified crossing-endpoint ramps**, with the same rendered top triangles supporting ordinary movement. The existing Dequindre Cut path keeps its separate lower level. Signal poles and span anchors retain the original road/building guards and additionally avoid the central walking band. See [sidewalk-README.md](sidewalk-README.md) for the dated source, authored dimensions, exact exclusions and reproducible geographic validation; native screenshots remain a separate check of the integrated scene.

The public Guide provides **six building-frontage destinations** plus **Jefferson Avenue · East Grand Boulevard** and **Jefferson Avenue · Woodward downtown**. Their **Travel to street view** action uses ordinary player travel and first-person viewing to reach a clear mapped position facing the relevant frontage or street. The capture script uses these same visible controls; it does not inject player or camera state.

Building arrival selection projects the source footprint and roof/base envelope with the live viewport aspect, the game's normal 60-degree vertical field of view and its 1.55 m on-foot eye. Positions remain within 140 m of the landmark center on Jefferson or a sourced cross street directly connected to it. Land, body clearance, continuous road connection and sightline checks remain required. Complete building framing is preferred; a long or obstructed silhouette can retain a partial horizontal frontage view in portrait while keeping its roof and base vertically visible. Current portrait qualifications apply to Stearns and Pasadena. Both street-end destinations retain their Jefferson approach views.

The circular navigation map also receives the connected City street and land geometry. Land polygons use their complete rings and preserve holes, so downtown roads appear without changing the original island map or GPS overlay behavior.

## Preserved geometry and collision behavior

Original map and district arrays retain their original objects and order. Rendering adds the extension data and detailed models, while `districtCollisionBuildings` separately expands the new courtyard collision parts. Existing collider objects remain in their original order and retain their original heights. The extension contributes **50 new collision solids**; taller landmark models receive additional upper collision envelopes where required.

Those supplemental vertical envelopes are deliberately conservative approximations over the retained horizontal rings. They can include roof voids and low-wing airspace. The Wells visual height correction does not lower the original 9.9 m collider. These envelopes are not exact architectural interior, roof-surface or walkable-roof models. Existing skyline geometry is retained and deduplicated against the new context footprints; this work does not establish new collision coverage for every preexisting skyline-only building.

The following original files remain byte-for-byte unchanged. The source protection checks are recorded in [extension-receipt.json](extension-receipt.json) and [extension-integrity.json](extension-integrity.json).

| Protected original file | SHA-256 |
| --- | --- |
| `game/public/belle/map.json` | `eb36e093fc477055c217025668403fc5d2c422bfdc9d9021769192dbb5660d87` |
| `game/src/belle/detroitDistricts.json` | `4006a1c523b08a5403f7101a45bd9f739c4aa4632d55a1be5c3676148cde0bdf` |
| `research/detroit-skyline.osm` | `3a14cf9492a3bdac59960130d25cd26ffa6904499a9963af2c539abe1647763e` |
| `tools/build-skyline.py` | `917d0c1d3d1fa7fb67a5942889fb623fffc036e1a652684af8b5a5f8733e3e25` |
| `game/public/belle/detroit-skyline.glb` | `987a3366c0964856615cb14ac51c010a615da42a00fd7b06fd2480f8cafd30a1` |

Paths in this table are relative to `lottominded-ultra.io/games/gothtechnology2/belle-isle-source/`.

## Base-revision coverage

The scope begins at East Jefferson / East Grand Boulevard and continues west to Woodward. The selection axis follows thirteen actual City of Detroit signal-intersection records, including records whose street name is `Jefferson`, `Jefferson E`, or `M-10(JEFFERSON)`. These inventory points are intersection centers, not signal-pole locations or surveyed road edges.

A 150 m distance from this axis and a 75 m endpoint margin select **261** source footprints whose `demolished` value is null and **174** original game footprints. The independent spatial criteria accept **133** one-to-one matches; **29** candidates remain ambiguous or below the overlap criterion, and **12** have no overlapping current source footprint. All rejected rows are retained in `crosswalk.json`.

At production base `893f769838166e6e35624b7b979ed5cbb8414507`, the game's Jefferson street ended at `[-2388.03, 1342.63]` in local metres. The Woodward intersection is `[-3511.972842, 2036.343896]`. Their direct separation is about **1,320.8 m**; this was an approximate missing-length indicator, not a surveyed path length. **76** source footprints lie west of that original endpoint. The candidate's additive extension described below now supplies the selected street geometry and qualified context footprints; native movement acceptance remains pending.

## Identified references

| Real building / address | Original game ID | Footprint IoU | Existing game height | Spatial result |
| --- | --- | ---: | ---: | --- |
| Frederick Stearns Building / Lofts at Rivertown, 6533 E Jefferson | `detroit-89989` | 0.819123 | 6.8 m | Accepted |
| Garden Court Apartments, 2900 E Jefferson | `868842406` | 0.857225 | 9.9 m | Accepted |
| John N. Bagley House, 2921 E Jefferson | `114282642` | 0.699190 | 6.6 m | Accepted |
| William H. Wells House, 2931 E Jefferson | `955779335` | 0.757980 | 9.9 m | Accepted |
| Pasadena Apartments, 2170 E Jefferson | `957898908` | 0.641221 | 36.3 m | Pending: below threshold |
| Manchester Apartments, 2016 E Jefferson | `948815834` | 0.609026 | 9.9 m | Pending: below threshold |

This table records the original crosswalk results and original map heights. Those source records remain intact; separate detailed models and conservative upper collision envelopes supply the new elevations. Several original heights are generic and conflict with visible multistory architecture. Pasadena's automated City match remains below threshold; the candidate's detailed model instead uses its independently verified original OSM identity, address and levels without changing the crosswalk threshold. Manchester remains an unqualified reference candidate.

Source `median_hgt` is retained raw with its unit explicitly **unverified**; it is never interpreted as metres or converted to a model height. Source `stories` and `year_built` are metadata, not overriding evidence: for example, the Garden Court source row contains a construction date that differs from its historic record. The current six landmark profiles reconcile the referenced story counts and visible architecture; all modeled dimensions remain estimates except Palms' historically reported overall height.

`landmark-references.json` records primary historic-register and EPA references, together with photo source pages. Photo pages identify reference views; no photo pixels or Google Street View panoramas are packaged as game textures by this intake.

## Reproduce source preparation

Use Python with Shapely available. Download the two source GeoJSON files and their query provenance to an input directory, then run:

```sh
python research/geographic/jefferson-realism/build-crosswalk.py /absolute/path/to/source-directory
```

The input directory must contain `building-footprints-complete.geojson`, `building-footprints-queries.json`, `traffic-signals.geojson`, and `traffic-signals.url.txt`. Exact service URLs, source hashes, original map hashes and projection parameters are recorded in `crosswalk.json`. Building queries are paginated by ascending `OBJECTID` at offsets 0 and 2000; the original download contains 2,021 source rows. The signal download contains 43 Jefferson-related records citywide, from which the thirteen corridor centers are selected.

Acceptance is declared before source assignment: intersection-over-union at least 0.65; centroid separation at most 20 m; best overlap at least 0.15 above the second candidate; and one source building matched to one game building. Potential many-to-one assignments are rejected. Original polygon rings are copied byte-for-value from the game JSON. No threshold is relaxed for a desired landmark.

For the additive extension, the same source directory also needs `city-streets-grand-to-downtown.geojson` and `city-streets-query.txt`. Use Shapely with constrained Delaunay triangulation support, then run from the repository root:

```sh
python lottominded-ultra.io/games/gothtechnology2/belle-isle-source/tools/build-jefferson-extension.py /absolute/path/to/source-directory
python research/geographic/jefferson-realism/validate-extension.py
```

The generator records exact query URLs and input hashes. The validator independently checks preserved source hashes, route joins, source-supported land, full authored road-width coverage, building deduplication and courtyard decomposition.

## Reproduce runtime checks and actual-game capture

Use Node.js 24 and the repository's locked dependencies:

```sh
cd lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game
npm ci
npm run check
npm test
npm run build
node --check scripts/jefferson-gallery.mjs
```

The normal test runner includes the five Jefferson test files for building geometry, extension integration, signals, signal planning and public travel. These are source and deterministic behavior checks; they do not by themselves establish visual or native performance acceptance.

`.github/workflows/belle-jefferson-gallery.yml` builds the exact candidate once, records source and built-asset hashes, then captures separate desktop and phone viewports on macOS 15 using native Chrome/Metal and reduced motion. Each run requests **eight daytime views and two nighttime street views**. Desktop uses high quality and the phone viewport uses smooth quality. The phone run is viewport emulation, not a physical-device result. Pull requests touching the relevant sources trigger this workflow; `workflow_dispatch` also accepts an explicit ref.

For the equivalent native macOS capture, install the parent browser dependencies and Chrome, then run the gallery from the game directory:

```sh
npm --prefix ../.. ci
cd ../..
npx playwright install chrome
cd belle-isle-source/game
node scripts/jefferson-gallery.mjs --write-build-receipt
ENV_GALLERY_DEVICE=desktop ENV_GALLERY_REQUIRE_METAL=1 ENV_GALLERY_NIGHT=1 node scripts/jefferson-gallery.mjs
ENV_GALLERY_DEVICE=phone ENV_GALLERY_REQUIRE_METAL=1 ENV_GALLERY_NIGHT=1 node scripts/jefferson-gallery.mjs
```

The receipt verifies every game source file, relevant map/configuration/capture inputs and every built asset across CI artifact transfer. Each gallery run retains the fixed **eight-minute** script budget, uses real advancing game-frame counters and a WebGL GPU fence, and records the actual renderer and read-only camera observations. `output/jefferson-gallery/<device>/<run>/` contains the standalone gallery HTML, screenshots and complete JSON report. CI uploads evidence even when a capture is partial or fails. An optional `ENV_GALLERY_SITES` filter is explicitly reported as partial coverage; it never establishes complete gallery or release acceptance. Offline Blender previews remain separate from this actual-game evidence.

### Initial native review retained

Candidate `0449793b358be35c4acd30c865dfba0dcbcf47ac` produced all 20 requested native screenshots in [gallery run 46084699068](https://github.com/robjasper2084/Jungle-Lotto/actions/runs/46084699068). Manual inspection found excessively close building arrivals, missing city roads in the circular map, and an entrance/window overlap. Those observations prompted the subsequent view, navigation and entrance corrections; capture completion alone was not treated as visual acceptance.

The same candidate's unchanged [90-second sustained run 46084698965](https://github.com/robjasper2084/Jungle-Lotto/actions/runs/46084698965) passed desktop/full, phone/full and desktop/diagnostic. Phone/diagnostic failed its original zero-over-250-ms gate with one **255.5 ms** interval on MacArthur Bridge, despite a passing **33.4 ms p95**. The baseline production-runtime reports had zero such intervals. The recorded workload and current code do not establish a cause for this isolated miss. The view/navigation/entrance corrections are not represented as a proven repair for that timing event; the original failed result remains part of the evidence, and the original gates apply again to the revised candidate.

Candidate `b10fde3c463be6d248df553395f21e0694a21083` produced all 20 requested native screenshots in [gallery run 46087627934](https://github.com/robjasper2084/Jungle-Lotto/actions/runs/46087627934). Recorded camera projections confirm complete desktop building envelopes and the documented portrait framing limits. The city map and retained doorways are visible. Further visual inspection found diagonal depth interference in Garden Court's pale bands in the distant portrait view and a tall blank stone roof cap on Wells. These concrete findings prompted the subsequent material-section and roof-volume corrections; this gallery is retained as evidence of the defects, not presented as their visual acceptance.

Its unchanged [90-second sustained run 46087628284](https://github.com/robjasper2084/Jungle-Lotto/actions/runs/46087628284) finished with two passing and two failing lanes:

| Native lane | p95 frame time | Maximum interval | Intervals over 250 ms | Original result |
| --- | ---: | ---: | ---: | --- |
| Desktop / full | 66.0 ms | 266.6 ms | 1 | Failed both the 50 ms p95 and zero-stall requirements |
| Phone / full | 33.6 ms | 146.4 ms | 0 | Passed |
| Desktop / diagnostic | 33.3 ms | 99.7 ms | 0 | Passed |
| Phone / diagnostic | 33.6 ms | 349.3 ms | 1 | Failed the zero-stall requirement |

The phone diagnostic miss occurred at the Jefferson bridge approach, unlike the earlier candidate's MacArthur Bridge location. The desktop full miss occurred on MacArthur Bridge. Independent frame observers corroborated the long gaps, but their CPU and long-task records did not establish the cause. All four runs retained every sampled frame, with no hidden time, browser errors or failed requests. Both full-scene GPS regressions passed separately; they do not override either native-ride failure. The following visual corrections are not represented as performance repairs, and no window, gate, scene or sample-retention rule was weakened.

Apartment wall bands now use adjoining material sections on the original wall plane instead of overlapping a complete masonry wall with stone skins 8–9 mm in front. Garden Court retains its two pale lower levels and pale upper level; Pasadena retains its pale base, and Palms retains its limestone exterior and brick courtyard. The change preserves footprint coordinates, story/roof heights, windows and collision records. A geometry regression probes the actual surfaces at several heights and fails the previous overlapping construction. Native captures of the revised geometry remain the visual check; this change is not a claimed repair for the earlier sustained timing miss.

Wells now has direct hip-roof faces joining its retained mapped eaves to an estimated level ridge, rather than a clipped rectangular gable closed with tall stone walls. A separate conical cap follows the small source bay at vertices 13–25. Two window stacks on the broad curved source arc 26–34 replace a blank facade caused by skipping its short individual edges. Roof, turret and window proportions remain photograph-informed estimates; the main/wing heights and all collision records remain unchanged. Actual-geometry regressions verify the street-facing roof at both detail levels, mapped eave coverage, supported turret cap and visible glazing on both wall stories. See the detailed inference and attribution in [photographic-evidence.md](photographic-evidence.md).

Candidate `c0ecca42c8daae96d63eacda0527e90b7b6ecad4` completed all 20 captures in [gallery run 46090955391](https://github.com/robjasper2084/Jungle-Lotto/actions/runs/46090955391). Native review confirmed the clean Garden Court bands and corrected Wells roof/bay windows. Review also found pale triangular intrusions in distant window panes on the Stearns and Pasadena phone views. A still establishes this visible defect, but does not establish temporal flicker. The existing solid stone frame placed an opaque face only 20 mm behind its glass, creating an unnecessary competing surface.

The same candidate passed all four original lanes in [90-second sustained run 46090955457](https://github.com/robjasper2084/Jungle-Lotto/actions/runs/46090955457):

| Native lane | p95 frame time | Maximum interval | Intervals over 250 ms | Original result |
| --- | ---: | ---: | ---: | --- |
| Desktop / full | 33.6 ms | 149.5 ms | 0 | Passed |
| Phone / full | 33.9 ms | 166.8 ms | 0 | Passed |
| Desktop / diagnostic | 34.4 ms | 155.3 ms | 0 | Passed |
| Phone / diagnostic | 33.4 ms | 232.4 ms | 0 | Passed |

Both full-scene GPS regressions also passed. These are accepted results for that exact candidate, with every sampled frame retained and no hidden time, application errors or failed requests. They do not prove the cause of the earlier misses or establish that a visual change repaired them. The subsequent window-frame revision requires its own exact-candidate native results under the same original gates.

Window frames now retain their four outer reveal faces and a rectangular front ring, with an open glazing aperture. The hidden wall-facing back and the stone face directly behind the pane are omitted. Outer dimensions, materials, depth, position, glazing, mullions and sills remain the same; neither polygon depth offsets nor the camera clipping planes are changed. A regression probes actual glazing centroids for stone in the 3–60 mm slice behind them and separately verifies that the visible border remains. It fails the previous solid frame and passes the hollow construction. The revised geometry uses 169,815 near-plus-far triangles in the same 60 meshes; the original allocation and native-performance gates remain unchanged.

## Sources

- [Published building-footprint service](https://services2.arcgis.com/HsXtOCMp1Nis1Ogr/ArcGIS/rest/services/Building_Footprints_detroit_2024_20250724/FeatureServer/0)
- [City of Detroit traffic-signal service](https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/Traffic_Signals/FeatureServer/0)
- [Garden Court National Register entry](https://npgallery.nps.gov/AssetDetail/NRIS/85002937)
- [Bagley House National Register entry](https://npgallery.nps.gov/AssetDetail/1fdcd5a2-786b-4fd9-a834-1ca47bcac422)
- [Wells House National Register entry](https://npgallery.nps.gov/AssetDetail/cb34a874-4113-4f5d-a8f3-a943686fbe40)
- [EPA Harbortown report, including Stearns reference](https://19january2025snapshot.epa.gov/sites/default/files/2021-04/documents/harbortown_report_final_0.pdf)


## Additive downtown extension

`game/src/belle/jeffersonExtension.json` is generated by `tools/build-jefferson-extension.py` under the Belle Isle source directory. It appends 13 exact City Jefferson centerline segments forming a continuous **1,338.308 m** route from the original endpoint to the City street junction at Woodward, plus 12 parallel northern carriageway segments and 27 connected cross-street stubs of at most 90 m. The northern chain is corroborated by an operator aerial acquired June 7, 2025; see [photographic evidence](photographic-evidence.md). The 14 m mainline and 10 m cross-street widths copy existing authored conventions; the City service does not provide surveyed road width or lane count. No original road array or centerline is changed.

One authored roadside verge is omitted on the Saint Antoine stub `city-jefferson-extension-32634-0` because it would overlap a retained building footprint. The sourced carriageway and existing building collision remain unchanged. This is a rendering omission of an authored verge, not evidence that a real sidewalk is absent.

Land is constructed from the full 198-node OpenStreetMap shoreline way `30353979`, confirmed as an outer member of Detroit River relation `5678328`. Exact source shoreline and the authored coverage envelope are polygonized; the inland component containing the official Jefferson route is selected. Existing original land and flat polygons are subtracted before the new polygons are exported. The resulting road surfaces, including their full authored widths, fit within the combined qualified land. No city-boundary water polygon is used as a land fill.

The extension adds **49** mapped building parts. It omits 26 candidates that overlap existing game footprints, overlap the footprint eligibility of the already-rendered skyline, or lie outside qualified coverage. Original skyline eligibility is reproduced from `build-skyline.py`, including its height and parent/part filters; 352 original skyline footprints are considered. Every omission retains its reason and overlapping source IDs in `extension-receipt.json`.

For new heights, the Palms Apartment House at 1001 E Jefferson uses **21.34 m**, based on the primary HAER inventory's reported 70-foot overall height, converted at 0.3048 m per foot and rounded to 0.01 m. The source is [LOC HAER inventory, printed page 43 / PDF page 44](https://tile.loc.gov/storage-services/master/pnp/habshaer/mi/mi0700/mi0746/data/mi0746data.pdf). It documents six stories plus basement; the reported height is historical evidence, not a new survey. Other heights remain explicitly labeled source-story estimates or one-story fallbacks. Source median-height values remain unconverted.

### Courtyard collision contract

Only Palms (`jefferson-city-8423552-0`) has an inner courtyard hole. Rendering uses the original `points` and `holes`. Collision uses its two `collisionParts` simple rings; the other 48 footprints retain one ring each, giving **50** extension collision solids. The two rings are formed by constrained triangulation, requiring whole-triangle coverage, then exact shared-edge unions that never reintroduce a hole. Their union has **zero symmetric-difference area** against the rounded source polygon. This enables the existing simple-ring collision implementation without changing global collision predicates.

The known courtyard witness `[-2707.46974, 1478.05044]` lies inside the outer building outline and outside both collision solids. The decomposition and witness are included in the runtime data and preparation receipt. `extension-integrity.json` records exact seam continuity, unchanged source hashes, nonoverlapping new building footprints, additive land/flat geometry, full road-width land coverage and courtyard preservation. These offline checks do not replace native movement, visual fit, or sustained performance acceptance.
