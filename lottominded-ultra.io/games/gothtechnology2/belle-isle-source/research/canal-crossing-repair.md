# Belle Isle canal crossings, pavement and marked crosswalk repair

## Scope and source discipline

User report: mini bridges over canals, crosswalks and streets are missing. This is a separate repair branch based on `a7b8a5f7eeefd093e8a81524736530e7c0f317f9`; it must not change the pinned PR139 co-op head or staging base. No direct production write, race-route edit, save migration, handling change, new dependencies or binary asset substitution.

Geometry comes from the existing `game/public/belle/map.json` snapshot (OSM, downloaded 2026-11-01). Retain its existing OpenStreetMap contributor attribution/ODbL provenance. Historic plans are reference evidence, not permission to restore removed roads or claim surveyed modern bridge dimensions.

## Primary reference research

- Michigan DNR official park map: https://www.michigan.gov/recsearch/-/media/Project/Websites/recsearch/documents/MapsA-D/belle_isle_map.pdf?hash=1B23A5EA37A6191DE7444285964266FD&rev=b494758e841245789feb562a8d24dee3
  Reviewed the map image for the current canal/trail/road network.
- DNR General Management Plan (2018), bridge inventory: https://www.michigan.gov/-/media/Project/Websites/dnr/Documents/PRD/MgtPlans-archive/BIP_GMP.pdf?rev=21bcd0bfc9b34d7ebeb80348022cbd64
  Historical references include Loop Canal/Central, Loiter, Picnic, Inselruhe, Nashua and Woodside. Not a current bridge-condition survey.
- City of Detroit engineering archive: https://dpwmaps.detroitmi.gov/dpw_maps/Maps%20and%20Records%20Bureau/Belle%20Isle/BW%2018%20small%20bridges/
  Contains small-bridge drawings for Picnic Way, Inselruhe and Lakeside culvert. Dimensions/ornament are not copied as though field-verified.
- Michigan Natural Features Inventory survey for MDOT (2020): https://mnfi.anr.msu.edu/reports/MNFI-Report-2020-19.pdf
  Reviewed actual map on PDF page 5 locating Vista Way, Central Avenue and Oakway Trail canal crossings. Historic repair survey, not present-day as-built certification.
- DNR May 19, 2026 traffic update: https://www.michigan.gov/dnr/about/newsroom/releases/2026/05/19/belle-isle-park-to-introduce-new-traffic-patterns-and-enhanced-two-way-bicycle-track
  Preserve existing current-versus-historic routing distinctions and cycle-track directions. This patch does not revert changed roads into old traffic patterns.

## Reproduced causes and precise repairs

1. `lagoonBridges()` explicitly selected only way `515099309` (Blue Heron). Other flagged crossings could have a flat pavement ribbon and terrain support but no structural deck sides or guardrails. The new structural plan covers 59 existing bridge/layer-tagged road and raised-path **way pieces**, excluding the dedicated MacArthur and Blue Heron systems. These are NOT 59 unique surveyed canal bridges: several ways are sidewalks or consecutive boardwalk segments.
2. Visible slabs, curbs, posts and rails share the same geometry plan with height-bounded collision. Corridor-union openings prevent new rails from sealing side paths or switchbacks. Existing alignments, widths and ground heights are retained. Rail styles and thickness are bounded game reconstructions, not photogrammetry. Structural meshes do not disappear with optional foliage quality settings and are frustum-culled by material/tile.
3. Street markings formerly skipped every bridge-tagged road. Small-bridge approaches now retain the existing road-marking generator; the separate MacArthur system is preserved. No route-centerline coordinates are moved.
4. Five marked source nodes were ignored by the old crosswalk lookup. Some were on sidewalks, one on a wide road, and one on a bridge. The new resolver follows actual connecting footways or the existing carriageway width, rejects unmarked nodes and deduplicates nearby representations. Four ignored nodes already represented painted crossing locations; the honest net count is **62 -> 63** unique locations, preserving every prior location and adding Central Avenue source node `14040681649`.
5. Pavement generation cut out all buildings, including open shelters whose terrain collision intentionally permits passage. Match that existing contract: restore the approximately 11.9 m missing portion of trail `1119933394` beneath an open shelter while retaining enclosed-building and museum-stair cutouts. The audit did not demonstrate wholesale loss of named street centerlines; do not claim an invented number of newly reconstructed streets.

## Validation and costs

- 109 targeted tests passed locally: mapped structures/collision, crosswalk provenance/deduplication, pavement, original terrain/Blue Heron checks, actual RideCore crossing of ten bridges walking/riding in both directions, and original controller regressions.
- Full-game strict TypeScript passed. The new tests are registered in the normal source-test runner; none of the existing tests or deadlines were removed/relaxed.
- Across all mapped road/path centerline samples, no new railing collision was found. Switchback way `1115092595` has a regression case.
- Added structural geometry totals 16,872 triangles in 50 material/tile batches across the entire island. Camera frustum culling limits what is drawn; this is NOT zero added draw calls or measured hardware FPS. No new textures, lights, render targets or asset downloads.
- Local Chromium cannot create WebGL2, so no successful local screenshot is claimed. The new scoped CI renders the actual bridge, pavement and street modules from the real map on desktop/phone sizes. Its images are a labeled isolated geometry review, NOT a replacement for the unchanged full-island startup/polish/package checks.
- Full checkout/build, complete race suite and actual-world rendering remain CI acceptance requirements. Do not merge or publish based solely on these CPU checks. Physical phones, sustained hardware FPS, complete current-world field survey and fine architectural fidelity remain unverified.

## Rollout

Keep this draft separate from PR139 and do not repin its approved release. After its existing release is resolved, combine through a reviewed normal merge and rerun the complete checks on the resulting exact candidate. No force push, timeout relaxation, manual unmerged bundle upload or production switch is included in this repair.
