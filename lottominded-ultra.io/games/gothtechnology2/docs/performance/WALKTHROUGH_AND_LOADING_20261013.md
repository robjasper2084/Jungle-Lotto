# Walkthrough and loading review — 2026-10-13

Local review build: port 4196. Publication is tracked separately. Real 2020 iPad Pro and human voice verification remain pending; both available participants are on the same Wi-Fi.

## Visual walkthrough

| Area | Observed result |
| --- | --- |
| Atwater food trucks | Curbside truck, serving hatch and branding visible; saved atwater-truck.png. |
| Cut carts | Grass-side placement clear of the main riding lane; branding present; commercial Play switches to Pause. Audible audio not certified. |
| Freight Yard | Container shells/platforms/tables present. White container paint verified as intentional authored material, not missing textures. |
| Milliken harbor | Boats, water edge, guardrails and gangway visible. Forward travel into the landing guardrail produces a collision; recovery works. The dock route turns at the landing; this is not a certification of every berth. |
| Valade and Aretha | Paths, beach/Shed approach and Aretha gate present. Valade arrival label corrected. |
| Detroit field sign | Supplied textured artwork visible ahead of trees. Starting-point selector previously sent the player to station 1600; now arrives facing the actual Milliken sign. |
| Mack / Innovation | Full Cut-facing mural visible across the wall; added an explicit mural arrival. Roof sign and hoodie model remain in the loaded asset set; GothTech merchandise interior inspected. |
| LottoMind / Penny | Door openings, branded storefronts and furnished interiors load. No real purchases/bids submitted. |
| Jazz Milliken and Mack | Both entry prompts launch the playable embedded music world with distinct club parameters. Rode 17 m and switched to walking; Return to Detroit works. Corrected Mack label previously falling back to Milliken. No claim of exact photographic likeness. |
| Elmwood | Startup/menu, ride from gatehouse, creek bridge, dense grove and mausoleum reviewed. Fixed mausoleum camera previously positioned inside its 41 m footprint; exterior verified after rebuild. |
| Royale | New collision transport loaded, ten-rider practice started, movement/collision/recovery and first-person hands visible. No console errors recorded in the final session. |

Screenshots: C:/Users/digit/Documents/phone/output/performance-review-20261013/. Some filenames describe a location rather than proof of every feature. The superseded elmwood-mausoleum.png shows the defect; elmwood-mausoleum-fixed.png shows the correction. Do not use valade.png as acceptance evidence because the shared tab was changed during capture.

## Fixes from the review

- Food-cart controls join the existing Nearby places drawer, keeping them away from the floating joystick; they hide in the main menu and pause their video.
- Ride options is a bounded two-column panel; community panel yields while it is expanded.
- Valade and Jazz labels, Detroit-sign arrival, and mausoleum review camera corrected.
- Current walk and prior cyclist separation behavior retained.

## Loading / rendering work

The downtown Rapier snapshot is replaced in browser delivery by lossless static collider geometry. The original map identity remains 14410cf246bba2c9574ec503ed937980543eacfe2a7c7c8d9857584c465c7cdb. All 2,014 colliders and every vertex/index value match; 65,447 query samples have zero ray-distance error. The dedicated download is 16,358,635 bytes, replacing about 60.6 MB compressed; transport expands to 44,529,336 bytes instead of 218,455,249 snapshot bytes. Rapier still constructs its acceleration structures locally; this is not the entire game memory footprint. See collider-review/report.json.

Trees reduce distant twig/leaf geometry; newly streamed buildings, trucks, containers and clubs receive static batching. Far-away ambient actors skip detailed terrain/collision queries beyond 180 m, while visible actors retain accurate queries. Elmwood budgets materials once per source asset and spreads cloned scenery attachment over frames. All games expose Smooth / 60 FPS target.

Royale showed Ready in 34s in this desktop local walkthrough; previous review was about 52s. Different cache/session conditions mean this is not a controlled benchmark. Swoop foreground samples still varied around 16–50 ms and longer; sustained 60 FPS is not certified. Earlier tab visibility/paused-time contamination made some FPS readings invalid. More profiling and the physical iPad route retest are required.

## Verification boundaries

Core, Swoop and Elmwood typechecks/builds passed. Focused collision transport, cache, tree LOD, hidden-mesh batching, mobile render-budget, pavement/bridge and crowd tests passed. The broader legacy trafficFlow test has one existing heading-threshold failure in trafficAt; the pure trafficAt/trafficRoute implementation is unchanged in this patch. The ten-minute anti-pileup simulation passed. Deployment replacement integrity tests passed (missing or corrupt replacement fails before legacy removal).

Still pending: controlled long-run mobile frame-time measurements, physical iPad retest, two-human audible voice, and cross-network voice/reconnect. A same-Wi-Fi pass cannot establish cross-network success. No relay renewal performed in this work.
