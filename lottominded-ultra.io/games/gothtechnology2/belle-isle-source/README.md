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
