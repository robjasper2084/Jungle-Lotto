# Boat Club and Windsor waterfront reference

Reviewed 15 November 2026 for the Belle Isle game. Geometry is an original game interpretation, not a photogrammetric reconstruction or a survey. No Google imagery is distributed with the game.

## Boat House

- [Google Maps place and exterior photos](https://www.google.com/maps/place/Belle+Isle+Boat+House/@42.3399549,-82.993689,17z/): Matthew Sullivan exterior photo, November 2025. Used the stepped terracotta roofs, offset square tower, ivory plaster, exposed-brick patches, rectangular upper windows and lower arched verandas.
- Google Street View, July 2022, panorama `oHlUUu6_Ize43BVV572Bbw`, position 42.3397788, -82.9933442, heading 303.56 degrees. Used the landward parapet, blue-green entry canopy, stairs and cream bridge balustrades.
- [Historic Detroit exterior gallery](https://www.historicdetroit.org/galleries/detroit-boat-club-current-photos-exterior-pre-renovation), [Michigan DNR Boat House page](https://www.michigan.gov/dnr/managing-resources/prd/boathouse), and [Detroit Boat House](https://www.detroitboathouse.org/) supplied supplementary context.

The existing mapped footprint and orientation are retained. Above-ground dimensions are estimated from these references. The two river-side visitor piers and berth spacing are gameplay additions for the user's exact LottoMind 2084 offshore speedboat and hydroplane; they are not presented as surveyed current marina infrastructure. Original boat models remain unchanged. Collision tests cover each hull's berth and straight departure, plus quay/pier deck heights.

## Windsor skyline

`game/src/belle/windsorSkyline.json` derives from OpenStreetMap contributors under ODbL 1.0. Per-building records retain the source way ID, footprint, height provenance and whether the geometry is a building part. Explicit heights are preferred; tagged storeys use 3.4 metres per storey. Selected untagged low-rise blocks use an approximate 10.2-metre backdrop height. The new silhouettes are persistent at all quality levels and share the Detroit night-window shader.

To reproduce, save these public API responses as `windsor-waterfront-0.osm` through `windsor-waterfront-2.osm` in a reference directory:

1. https://api.openstreetmap.org/api/0.6/map?bbox=-83.045,42.316,-83.015,42.332
2. https://api.openstreetmap.org/api/0.6/map?bbox=-83.015,42.323,-82.985,42.34
3. https://api.openstreetmap.org/api/0.6/map?bbox=-82.985,42.328,-82.955,42.35

Run `node tools/prepare-waterfront-skyline.mjs <reference-directory>` from `belle-isle-source`. The generator filters the south-bank waterfront corridor and writes the small runtime JSON; raw city extracts are not shipped. [OpenStreetMap attribution and licence](https://www.openstreetmap.org/copyright).
