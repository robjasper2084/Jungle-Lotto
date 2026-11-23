# Belle Isle vegetation and landmark audit

The three sector anchors use the game’s local metre grid with east-positive X and south-positive Z. The origin is 42.3468° N, 83.00175° W. The Blender file arranges plants in a studio scene and contains no geographic control points. The game places them relative to the original profiling waypoints.

| Sector | Waypoint latitude, longitude | Placement and alignment |
| --- | --- | --- |
| Shelter 17 | 42.3410418, −82.9662621 | The roof and curved entrance path line up with the satellite view. The dense forest lies northwest of Woodside Drive. The lakeside pavilion, playground and lawn remain open. |
| Nashua Canal | 42.3403254, −82.9754326 | The footpath follows the canal bend in the imagery. Tree and shrub groups sit south of the trail. The guide uses the mapped footbridge approach from the performance report. |
| Oakway Refectory | 42.3440152, −82.9771616 | The game footprint follows the rotated, cross-shaped brick building. The roof wings, green metal seams and chimney follow the Portage Way panorama. Vegetation stays southeast of the building and outside the paved court. |

The runtime draws 18 tree and six shrub placements from Painkiller5555’s Trees & Bushes pack. Two perpendicular views of the original Blender meshes `tree.009` and `tree` share a 768 × 768 atlas. The three sector meshes total 96 triangles. The vertex bounds are computed once from the final world-space vertices. Road clearance uses the crown width and the mapped path width. All 24 placements passed the shoreline and path checks.

The WGS84 GeoJSON and KML contain game geometry, the actual planting points, the open lawn and two Google Street View camera positions. The comparison used the 100-foot scale on each north-up Google satellite view. Around Shelter 17 and the Nashua Trail, the visible path is roughly five to seven screen pixels wide, about 2.2–3.1 metres. The game uses 2.6 metres on those paths. Imagery supports the road curves and footprint orientations at this scale. Crown sites and heights are representative, and individual trunks were not surveyed. [Shelter 17 satellite](https://www.google.com/maps/@42.3410418,-82.9662621,180m/data=!3m1!1e3) · [Michigan DNR park map](https://www.michigan.gov/recsearch/-/media/Project/Websites/recsearch/documents/MapsA-D/belle_isle_map.pdf)

Street View at the Portage Way junction shows the low brick refectory, its chimney and green roof. Woodside Drive has a dark railing above a light-colored curb, with stone on the canal banks. The stone treatment is limited to the mapped banks upstream of this bridge. The Street View camera is about 560 metres east of the wooded Nashua Trail test sector. That sector was checked against satellite imagery. [Portage Way panorama](https://www.google.com/maps/@?api=1&map_action=pano&pano=CRkL5mDiqRggE0FPacE8IA&heading=88) · [Woodside Drive panorama](https://www.google.com/maps/@?api=1&map_action=pano&pano=5ZKzFZ1otw259hlAaDVzUg&heading=300)

## Performance

These are Windows Chrome measurements on the packaged local game at the archived iPad viewport size. The archive attributes the 139 ms p95 and the 94.4% reduction to Candidate 7. Candidate 8 improved the cockpit LCD update path. This integration uses the archive’s LCD redraw checks and stable per-tree bounds cache. Architecture materials are static and use no recurring texture updates.

| Sector | Accepted frames | Walked (m) | p95 interval (ms) | Longest interval (ms) |
| --- | ---: | ---: | ---: | ---: |
| Shelter 17 | 865 | 31.2 | 33.1 | 283.3 |
| Nashua Canal | 569 | 31.2 | 33.6 | 283.3 |
| Oakway Refectory | 562 | 20.9 | 33.0 | 1749.8 |

Across the fresh browser session, the far-tree cache performed 8,340 transforms for 181,820 local-bounds requests, avoiding 95.41% of those calculations. The placement tests enclose every new vertex and exercise culling across camera changes with real far-tree geometry. The walkthrough and performance profile were captured separately to keep video encoding out of the timed intervals.

All three p95 measurements met the requested 139 ms ceiling on this machine. Individual frames exceeded it. An earlier integration run recorded a 21.1-second stall at Shelter 17. Its cause remains unverified, and these desktop measurements cannot establish physical iPad performance. See the recorded walk and per-site measurements alongside this report.
The short edited walkthrough trims a prolonged hold in the Shelter 17 recording. The uncut first-entry clip is preserved in `shelter-first-entry.webm`. The timing table uses the separate unedited profiler intervals.
