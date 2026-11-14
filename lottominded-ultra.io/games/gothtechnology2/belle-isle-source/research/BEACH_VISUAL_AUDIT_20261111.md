# Belle Isle Beach — reference-guided visual audit

## Verified references (do not import copyrighted photographs as in-game textures)
- Official Belle Isle Conservancy waterfront/road aerial: https://www.belleisleconservancy.org/explore
- Michigan DNR park and designated swim beach: https://www.michigan.gov/recsearch/parks/belleisle
- Michigan DNR multimodal survey, Figures 3.18–3.21 (beach from parking lot, Riverbank Road, and open shore): https://www.michigan.gov/dnr/-/media/Project/Websites/dnr/Documents/PRD/BI-archive/Belle-multimodal/BelleIsleMobilityStudy2024Ch3AttendanceParkingCapacity.pdf

This change uses the existing game map as the authoritative geometric footprint. The reference photos inform shoreline slope, open main strand, dry-to-wet sand transitions, grassy landward margin, and distant skyline composition. A licensed Street View photo was **not** downloaded or embedded. The implementation is a photo-guided approximation rather than surveyed elevation/photogrammetry.

## Changes
- Re-generated fine beach mesh using the same `beachHeight` height sample that supports feet, wheels, and collision normals. Slight sediment variation tapers to zero at both mapped edges.
- Preserved the existing 3 albedo/normal/roughness texture maps. Wet sand gains realistic low-roughness highlights, dry sand stays high-roughness, and fine grain fades below the pixel scale.
- Added only sparse boundary-set **instanced** stones, driftwood and grasses. Placement is deterministic and rejects roads, water, buildings and obstacles. The public swimming strand stays open.
- Three reusable draw-call pools are distance-culling; there are no new image, video, shader-pass or render-target downloads.

## Screenshot / performance gate
The desktop `scripts/activity-browser-smoke.mjs` now travels through the real Island Guide to **Belle Isle Beach** and saves `belle-isle-beach-waterline` before continuing its usual photograph workflow. Review the capture alongside the three external references at the same season and time-of-day. This smoke is evidence of rendering, **not** an automatic pixel-accurate Google Street View comparison or mobile FPS certificate.

For manual review: compare tide band, beach curvature, density near the backshore, sidewalks/road buffer, distant skyline and whether the sand appears overly metallic. Also inspect a mobile Smooth-mode run; check that the existing quality picker reduces shoreline detail and the game stays responsive. Use `?profile=1` for in-game performance evidence. The seven production gates and the hard **1024 MiB Pages cap** remain mandatory.
