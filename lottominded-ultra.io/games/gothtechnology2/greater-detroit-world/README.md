# Greater Detroit World — honest bridge/Elmwood connection foundation

This branch adds geographic transformation and collision-safe pose handoff logic for a future single-renderer runtime. Its transforms and tests **do not** claim that the three playable games have been merged.

## Verified source anchors

Belle Isle bridge endpoint coordinates come from belle-isle-source/tools/prepare-map.mjs (projected geographic OSM endpoints). Swoop local X/Z axes use its geography.ts GPS transform. Elmwood local grid is approximately georeferenced with the known Young memorial GPS anchor from elmwood-details.ts. One GPS anchor is insufficient for surveyed orientation and elevation; verify at least three independent control points and vertical geoid/datum before physical seams.

## Physical work still required

**Bridge:** the Belle Isle game already models/physically supports MacArthur Bridge, but the Swoop street world stops west of the bridge. Author real Jefferson/East Grand roadway segments, stream associated landmarks and collision, and match Belle's physical bridge deck height and approach collision. Keep the existing bridge world resident until the arriving rider and all traffic are actually supported by the Swoop geometry.

**Elmwood:** connect Swoop's existing riverfront/urban streets to a modeled Elmwood Avenue corridor and the cemetery gate. Register surveyed endpoints, source road waypoints from authorized OSM/geospatial data, connect terrain/collision and preserve RideCore, companions, race state and NPC collision. Do not teleport to the gate or invent missing road segments.

**One renderer and simulation:** the three existing pages each currently create their own WebGLRenderer and physics. Before gameplay continuity is real, migrate to a host that owns one renderer, shared assets, one time/weather clock and sim, streams district visuals/physics separately, and retains both collision zones during handoff.

## Safety and acceptance

transferAcrossVerifiedSeam() refuses to run without geometry alignment, collider continuity, navigation link, preloaded assets and independently verified height datum; callers must provide real sampled ground heights and only mark flags true after actual in-engine tests. The unit test that passes all flags is hypothetical and verifies coordinate math only.

For a genuine release, run actual bridge/Elmwood traversal both directions on the real games, verify no clipping, collision holes, loss of player speed or camera jitter, and meet the independent PR #186 screenshot, build, device-performance and peer-review acceptance requirements.

No production merge or deployment authorized. No synthetic roadway is shipped as photogrammetric Detroit.
