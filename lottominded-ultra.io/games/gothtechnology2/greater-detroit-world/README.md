# Greater Detroit crossings

Belle Isle Explorer hosts the connected ride. Start at Jefferson Avenue. Head southeast over MacArthur Bridge for the island, or follow East Jefferson west to Swoop Detroit. The Detroit guide marks the Dequindre Cut overpass and the cemetery entrance. The city minimap shows the ride to Elmwood in amber and the ride to the bridge in green. Both routes use the same renderer, rider, terrain sampler, camera, and clock.

## Run and verify

From the Belle Isle game directory, install the locked dependencies and run the existing build and preview commands. The Greater Detroit changes run through its ordinary start screen. From this directory run `npm test` for coordinate and readiness checks, then `npm run test:rides` for the full controller drives. The drive test runs both directions on each road using throttle and steering. It fails on a crash, a stall or a missed destination.

## Map sources

The MacArthur bridge uses the existing game's deck. Endpoint A is on the mainland and B is on the island. The city streets follow the City of Detroit Street Centerline Map. Building outlines in the gap on Jefferson use the City's Base Unit Features building layer. Swoop supplies mapped streets, buildings, the 2.63 km Dequindre Cut alignment, its relative trail grade and eleven overpass footprints. The greenway passes beneath East Jefferson while the city ride stays on the deck. Elmwood supplies its gatehouse-based projected coordinate system, survey-derived terrain grid, lanes, cemetery layouts and landmark models. Heights use the game's relative datum. City building dress and heights are visual approximations.

`tools/build-mainland.mjs` regenerates the compact district map using the source maps and two city GIS queries. Optional positional arguments are the cached street and building GeoJSON files in that order. The generator loads polygon-clipping from Belle's installed dependencies. The mounted host samples its collision surfaces along both routes before offering district destinations. Independent game runtimes still use the guarded transfer API where applicable.

## Scenery

Four textured buildings from Street at Sunset fit mapped rectangular footprints. Nearby scenery includes camera-mapped façades, bins, grass tufts, wildflowers, gulls and driftwood. The shared scenery atlas uses existing local Blender derivatives. Credit notices for the four archives accompany this directory. Street at Sunset and Seagull were supplied as individual Blender files. The Detroit guide displays the asset credits.

`tools/export-sunset-block.py` exports the four source buildings from an open copy of Street at Sunset in Blender. `tools/pack-elmwood-models.mjs` creates reduced-texture copies of the original gatehouse, chapel and entrance sign with FFmpeg. The game keeps simplified building outlines at long range and loads the Elmwood landmarks on approach.

The connected space covers the island, the East Side street corridors, and the cemetery. The standalone games continue to provide their additional modes. Production deployment, independent review, and physical-device performance acceptance are separate release stages.
