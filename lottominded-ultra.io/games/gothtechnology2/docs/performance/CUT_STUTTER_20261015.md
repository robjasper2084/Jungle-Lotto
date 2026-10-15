# Dequindre Cut stutter repair - 2026-10-15

The user reports severe stutter/freezes at Adelaide Street and farther north on both Windows and a 2020 iPad Pro with Chrome.

## Implemented

- Split the 13 bridge-mural textures into individually prioritized nearby jobs. Owned mural textures, materials and geometry unload beyond a 200 m hysteresis margin and reload on return. Wall backings and collision stay resident and do not duplicate. This does not unload every other scenery asset.
- Limit scenery loading to one job at a time. A mural attachment yields a frame before the next job completes.
- Batch compatible multi-material static meshes by material inside their existing tiles. Preserve compact indexed vertices, world transforms, bounds, hidden surfaces, shadow flags and collision.
- The 120 Hz custom rider controller reuses unchanged Rapier query state between 30 Hz traffic updates. Added scenery marks queries dirty; explicit setup calls always flush. Rigid-body worlds retain full stepping. Recovery timers still advance every controller tick.
- Community cycling avoids constructing static obstacle records that its simulation immediately discards; static collision remains in the terrain raycasts.
- Cache pedestrian shoe measurement per source asset. Replace all shoe vertices with their exact convex Y/Z support outline; the floor minimum is identical at every ankle pitch. Remove per-pose vertex arrays and redundant trigonometry.
- Dispose removed pedestrians' owned skeleton textures. Shared source geometry/materials/textures remain owned by their asset loader.

## Validation

- Performance/resource tests cover compact batching, hidden surfaces, stream priority/concurrency, split-view observers, unload/reload and persistent collision, exact shoe support, and collision-refresh reuse/fallback.
- Real loaded hoodie rigs pass 13 gait/fall/recovery/contact tests, including all five hero fits.
- Bridge riding and street support checks pass in both directions, including Adelaide hopping/recovery and East Jefferson rider/dog recovery.
- TypeScript check uses the review project's installed compiler and tsconfig.performance.json. Production package build includes Swoop, Royale and Elmwood. Latest origin/main Royale first-person arms/graphics sources were retained before rebuilding.

## Performance limits and outstanding verification

The initial local batching/mural-only build still fell to 20-28 FPS near Wilkins, so it was not sufficient. These readings motivated the collision and pedestrian changes. A later Adelaide check after the collision change recorded 48.2 FPS and 14 ms CPU frame time (1.5 ms cumulative simulation, 5.4 ms cumulative actors, 13.8 ms cumulative rendering). Its rolling p95 was still 50 ms. This is a short, partly stationary check, not a controlled route comparison or a stable 60 FPS result.

The iPad has not been retested with this patch. Do not describe freezes as eliminated or 60 FPS as verified. A three-minute continuous ride from Adelaide through Wilkins/Mack, followed by a return trip, must check frame spikes, resource growth, context loss and missing murals on both devices. No graphics preset or authored artwork quality was lowered by this patch. Real-player voice and other earlier audit items are outside this targeted repair.
