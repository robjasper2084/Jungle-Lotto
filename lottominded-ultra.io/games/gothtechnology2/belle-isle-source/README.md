# Belle Isle Explorer — local reconstruction

Local review: http://127.0.0.1:8301/

This is a playable geographic prototype, not a finished photorealistic recreation. The existing Swoop Detroit, Static Royale and Elmwood releases were not changed or deployed by this task.

## Implemented
- Starts at East Grand Boulevard / Jefferson Avenue, facing MacArthur Bridge.
- OSM-derived island outline, lagoons, roads, paths and building footprints. Units are metres; browser X east, Y up, Z south.
- Mapped Detroit skyline across the river: Renaissance Center, Guardian, Penobscot and surrounding downtown. Five consolidated render batches, approximately 1.6 MB. Sunset Point travel faces downtown.
- Nineteen open bridge arch spans, slender spandrel supports, metal railings and lamp posts; a traversable crowned deck and water/rail collision boundaries.
- Blender-authored approximate exteriors for the conservatory, aquarium, casino, fountain, carillon, lighthouse, museum, boat house, yacht club, music shell, pavilions, nature center, golf clubhouse and Giant Slide.
- 124 unique destinations in the island guide (featured landmarks, mapped points and activity destinations, deduplicated). A guide entry is not a claim that a detailed sculpture/interior has been modeled.
- Existing RideCore 1.2.0 and current armored rider reused: riding, walking, remount, hop and recovery.
- Keyboard and floating touch movement; camera switch, pause, reduced camera motion, hideable map, opacity preference and 30/60 FPS targets.
- Shared oak render assets with alpha-tested near foliage and crossed-card distant LOD. Landmark distance culling and bounded detailed tree counts.
- Separate Unity 6000.3.24f1 authoring project. FBX imports compiled; scene saved with five geographic surface groups and 56 landmark renderers. FBX handedness is corrected at the import roots.

- Focused reference-led Aquarium portal, Conservatory glazing and Carillon crown refinements; weathered CC0 masonry and photographic sky/environment lighting.
- Graded bridge approaches, full-width deck repair, mapped mainland shoreline and separate underpass height.
- Irregular meadow clumps with clear route shoulders, bounded to three instanced draw batches.

- Casino: buff open arcade, framed upper glazing, terracotta roof and square belvederes from official exterior imagery; arch face winding corrected.
- Dossin Museum: mapped L-shaped massing, flat roof, blue masonry, aluminum joints, glazed public entrance and readable inscription facing Strand Drive.
- Offline street plan: named-road lane paint, two-way cycle-track separators, 53 mapped crossing placements, grade-following curbs/gutters, drains and 52 readable street/facility/speed boards. Signs and curb gaps clear the full road/path network.
- Street geometry is tiled and distance-culled. The shared sign atlas is 1024 × 2048, with no additional dynamic lights.

## Files
- game/src/belle/: runtime, terrain, scenery, UI and tests.
- game/public/belle/map.json: derived geographic data.
- authoring/Belle_Isle_Landmarks.blend: editable architectural source.
- authoring/Belle_Isle_World.blend: geographic base, landmarks and distant Detroit skyline.
- authoring/Detroit_Skyline.blend: editable geographic skyline; GLB and Unity FBX exports.
- authoring/Belle_Isle_Landmarks.fbx: Unity-compatible landmark export.
- UnityProject/Assets/BelleIsle/BelleIsle.unity: imported Unity authoring scene.
- assets/limestone-higgsfield.png: original approved 2K texture.
- tools/: reproducible map preparation, Blender generation/export and Unity validation scripts.
- research/: source geometry and coverage inventory.
- qa/: screenshots, validation and remaining work.

## Run and verify
From game/:

    npm ci
    npm run check
    npm test
    npm run build
    npm run preview

Preview listens on 127.0.0.1:8301. npm run dev uses the same port; run only one server there. The build manifest currently lists 42 required public assets (108.0 MB uncompressed, excluding compiled JS/CSS). This is not a measured cold-start transfer. The varied nature library is 8.28 MB; high-polygon source blends are excluded.

Blender: node tools/run-blender.mjs, node tools/build-skyline.mjs, then node tools/export-unity-world.mjs and node tools/export-unity-terrain.mjs from this project root.
Unity: open UnityProject in Unity 6000.3.24f1, or run the project-scoped tools/unity-authoring.mjs using the normal desktop license context. The Unity scene is an authoring/asset-validation scene, not a Unity port of RideCore. This pass synchronizes the landmark FBX and mapped base surfaces; the new text-atlas signs, street detail, historic-house refinements, habitat, koi and fountain/audio effects currently run in the browser only.

## Fidelity and remaining work
- The generated architecture is a proportional reconstruction from mapped footprints and references. It is not a photogrammetric scan or a complete architectural survey.
- Fine sculpture, carved ornament, seasonal planting fidelity, pavilion details and additional memorial geometry remain incomplete. Named markers do not replace these assets.
- Mainland shoreline and terrain elevations are approximations; the full island uses a mostly flat elevation plane. No surveyed elevation model has been integrated.
- Glass, brick, roofs, landscaping and river reflections need a further material pass to meet the requested photorealistic standard. The Aquarium, Conservatory, Dossin Museum and Detroit Yacht Club have walkable interiors; other building interiors remain incomplete.
- Google satellite views and public Aquarium visitor 360 panoramas were reviewed. The Conservancy guide, Getty tower preview and supplied photographs are logged with coordinates and unresolved blind spots in research/LANDMARK_REFERENCES.md. Other facades still require ground-level verification.
- Unity runtime gameplay, device testing, long-duration memory checks and an iPad/Quest session are not verified. No sustained 60 FPS claim is made.
- The browser's JavaScript bundle is about 3.08 MB uncompressed; Vite reports a large-chunk warning.

See qa/VERIFICATION.md, research/SOURCES.md and research/LANDMARK_REFERENCES.md.

For focused model updates: node tools/refine-landmarks.mjs (optional comma-separated OSM IDs), then node tools/refine-materials.mjs, copy the FBX to UnityProject/Assets/BelleIsle, export the full world and rebuild the game. Full regeneration remains available through tools/run-blender.mjs.


## Free nature authoring

The browser now uses four Sapling-generated tree forms and twelve Poly Haven grass, flower and rock variants. See research/NATURE_ASSETS_20261102.md for licenses, budgets, reproducible export commands and remaining visual/device checks. Editable source: authoring/Belle_Isle_Nature_Trees.blend and authoring/Belle_Isle_Nature_Groundcover.blend.

## Pond, fountains and habitat (2026-11-02)

- Twelve original animated koi stay below the conservatory pond surface. Use Island guide → Conservatory Koi & Lily Pond → Travel to path.
- All three modeled fountains have flowing water: James Scott, Leaping Gazelle/Barbour and Children's Temperance. The guide offers an on-foot visit to the indoor Temperance fountain.
- Settings → Nature & water sounds controls synthesized birds, breeze and nearby fountain splash. Volume and mute are saved; audio pauses with the game, dialogs and background tabs.
- Lake Okonoka and Blue Heron Lagoon have bounded wetland planting, timber and shoreline detail. Blue Heron's inlet footbridge has matching height-limited rail collision.
- Photo-guided White House and former Stable Yard exteriors, mapped facilities, open gates/fences and CC0 pigeons are documented in research/.
- Latest TypeScript check, 91 automated tests and build pass. The served preview was byte-checked against the rebuilt output. Visual checks include koi, three fountains, Lake Okonoka, Blue Heron, historic houses and facilities. Timed FPS and physical device checks remain deferred; these are local changes.

## Detroit Yacht Club (2026-11-02)

Photo-guided facade, two open entrances, a furnished clubhouse with grand stairs and four marina piers with 32 moored boats. Use Island guide → Detroit Yacht Club to visit the entrance, interior or marina. Editable Blender source, coordinate/reference log and limitations are documented in research/YACHT_CLUB_20261102.md. Type check, 99 tests and production build passed; local only.

## Courts, ballfields, trails and Floral Clock Hill

Nine public tennis courts, three mapped basketball courts and five mapped ballfield outlines now have authored surfaces and equipment. Tennis has singles/doubles/service markings and sagging nets. Basketball has keys, arcs, backboards, rims and nets. Ballfields have bounded dirt infields, bases, mounds, foul lines, benches and backstops. These are explorable facilities, not ball-sport mini-games. HYPE's current inventory lists four active baseball/softball fields and two basketball courts; the map also retains historical/multipurpose footprints, so rendered counts do not imply all are currently operating.

The guide includes Nashua, Trout Lily, Driker and Ralph C. Wilson Jr. trailheads; the minimap distinguishes mapped trails from driving roads. Signs stand off the route. Floral Clock Hill is at the island end of MacArthur Bridge, based on mapped clock node 4894343387. Its roughly 30-foot face, flowering border and mound are a reference-informed reconstruction. Analog hands follow the game sky time. The terrain adds the mound to the existing approach slope; no mapped road is raised by the mound. Vegetation stays clear of the clock planting.

Sources: [HYPE Athletics](https://hypeathletics.org/belle-isle/), [Michigan DNR](https://www.michigan.gov/recsearch/parks/belleisle), [DNR park map](https://www.michigan.gov/recsearch/-/media/Project/Websites/recsearch/documents/MapsA-D/BelleIsle_ParkMap.pdf?hash=8FAA503B0DE088363F2C6BA3822FBC43&rev=5f5e337c82164440a42a94b1078b2366), [Historic Detroit clock history](https://historicdetroit.org/buildings/floral-clock-at-water-works-park), and OpenStreetMap geometry (ODbL). Exact seasonal planting, slope, equipment and field orientation are approximated. No paid generation was used for these additions.

## Giant Slide and lagoon wildlife (2026-11-03)

The Giant Slide now has stairs on the right when facing uphill, matching the referenced 2015 photograph. Island guide → Giant Slide → Go to slide stairs leads to the climb action. The rider parks the wheel, climbs three flights, waits at the top for Slide down, sits on a mat, descends and stands at the runout. Recover / R cancels safely. Existing ride physics and bone lengths are unchanged.

Four swans and two ducks swim near the eastern Blue Heron Lagoon viewing path. Original shared meshes and six bounded analytic routes keep them off the banks and inlet bridge. The helmet logo and back charm retain their asynchronously loaded textures during the material pass.

The reference audit now covers all 124 guide destinations and distinguishes reviewed photographs from search links and uninspected ground views. This is a coverage log, not a claim that every landmark is photorealistic. See qa/ACTIVITIES_VERIFICATION_20261103.md and research/LANDMARK_AUDIT_20261103.md. Local only; timed foreground performance and physical-device checks remain deferred.
