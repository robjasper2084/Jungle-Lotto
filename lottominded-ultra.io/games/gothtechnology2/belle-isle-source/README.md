# Belle Isle Explorer

Standalone browser game published at ../store/public/arcade/belle-isle-explorer/.

## Build and validate

From game/: npm ci, npm run check, npm test, npm run build. Commit the resulting dist contents to the public route together with source changes. The packaged map and authored models are the runtime inputs; a Blender install is not needed for web builds.

## Controls

WASD/arrows move, F walks/rides, B mounts the hoverbike, V changes riding camera. P equips the camera, Space takes a photo, R starts/stops video, Escape puts it away. Camera bodies reuse Static Royale's Static/Heart/Bass assets; 18/35/50/85/135 mm lenses and 1x/2x/4x viewfinder zoom are available. The rear LCD shows the world. Captures omit the HUD and first-person equipment. JPEG photos and clips (up to 60 seconds) remain local until Save/Share. Only game output is recorded; no microphone or real camera permissions are requested.

Enable the optional Boerboel in Settings. Follow, Sit, Stay, Lie down, Come and Bark commands reuse the existing Elmwood companion. It waits at the last dry ground when the rider flies or crosses water. The docked tail is not animated.

## Bridge reconstruction

Ambassador tower anchors and bank outlines use OpenStreetMap data (ODbL, https://www.openstreetmap.org/copyright). Main span 1,850 ft and tower height 386 ft follow the operator: https://www.ambassadorbridge.com/bridge-facts/. Public photograph references: https://feliciafullwood.com/blog/detroit-photo-spots-places-to-see and https://www.tangjies.com/photos/windsor/index.html.

The bridge remains in its downriver location; Island guide > Ambassador Bridge overlook offers a clear view from Sunset Point. Roadway light poles, cable illumination, tower lettering and red beacons follow the sky clock. Existing MacArthur cast-metal poles keep their authored positions and receive matched globe emission, light pools and nearby illumination for moving characters. Fixture spacing and fine steel details are a photograph-guided approximation, not an engineering survey.

Blender sources for the skyline are tools/build-skyline.py and tools/ambassador_skyline.py with the included OSM inputs. Create authoring/ and UnityProject/Assets/BelleIsle/ before running Blender in background with build-skyline.py. This exports .blend, .glb and .fbx geometry. Runtime bridge lighting, camera controls and companion behavior in this release are browser features; they are not claimed as Unity runtime features.

Third-party nature, sand and bird licenses remain beside their runtime assets. Geography and nature credits are available in the Island guide. No new paid generation was used for this update.

## Hoverbike lighting

Open Lighting while riding. Choose any LED color, use K for six presets, or select Slow color cycle / LEDs off. L toggles the two white headlights; H toggles high beam. LEDs and headlights work independently. The chosen LED color and effect persist locally. Reduced Motion holds the selected LED color; pausing stops the cycle. Headlight beams illuminate nearby world geometry and characters, with no extra shadow maps.

## Grass, mature trees and road clearance

A bounded pool of curved, wind-animated grass blades adds short verge grass, rough meadow and woodland ground cover. The placement plan excludes roads, water, garden beds, sports and play areas. Reduced Motion stops blade wind. Tree heights are authored at roughly 14–32 m and match between close geometry and distant cards. These are visual/gameplay approximations, not a tree survey.

444 drivable ways receive wider cruising allowances (ordinary roads at least 8.4 m, service roads 7.2 m, links 6.8 m). Existing wider roads, separate cycle-track width, pedestrian paths and bridge decks are retained. sourceWidth records the previous estimate. The shared pavement and curb plans use these same widths.

REA inspected this project’s compiled JavaScript as inert text. No PUBG application or assets were reverse engineered or copied. Build nature placement with `node --experimental-strip-types tools/build-nature-plan.mjs`, then grass placement with `node --experimental-strip-types tools/build-meadow.mjs`.

## Courts, ballfields, trails and Floral Clock Hill

Nine public tennis courts, three mapped basketball courts and five mapped ballfield outlines now have authored surfaces and equipment. Tennis has singles/doubles/service markings and sagging nets. Basketball has keys, arcs, backboards, rims and nets. Ballfields have bounded dirt infields, bases, mounds, foul lines, benches and backstops. These are explorable facilities, not ball-sport mini-games. HYPE's current inventory lists four active baseball/softball fields and two basketball courts; the map also retains historical/multipurpose footprints, so rendered counts do not imply all are currently operating.

The guide includes Nashua, Trout Lily, Driker and Ralph C. Wilson Jr. trailheads; the minimap distinguishes mapped trails from driving roads. Signs stand off the route. Floral Clock Hill is at the island end of MacArthur Bridge, based on mapped clock node 4894343387. Its roughly 30-foot face, flowering border and mound are a reference-informed reconstruction. Analog hands follow the game sky time. The terrain adds the mound to the existing approach slope; no mapped road is raised by the mound. Vegetation stays clear of the clock planting.

Sources: [HYPE Athletics](https://hypeathletics.org/belle-isle/), [Michigan DNR](https://www.michigan.gov/recsearch/parks/belleisle), [DNR park map](https://www.michigan.gov/recsearch/-/media/Project/Websites/recsearch/documents/MapsA-D/BelleIsle_ParkMap.pdf?hash=8FAA503B0DE088363F2C6BA3822FBC43&rev=5f5e337c82164440a42a94b1078b2366), [Historic Detroit clock history](https://historicdetroit.org/buildings/floral-clock-at-water-works-park), and OpenStreetMap geometry (ODbL). Exact seasonal planting, slope, equipment and field orientation are approximated. No paid generation was used for these additions.
