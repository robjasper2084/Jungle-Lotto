# Startup and facade polish — local review

Scope: Swoop Detroit and Static Royale. These changes are built locally; no publication or Git push was performed.

## Implemented

- Both startup flows prepare visible textures, compile shaders asynchronously, and render the initial view before reporting ready. Hidden game rendering no longer competes with the startup video. Royale previously rendered its partly constructed scene during loading.
- City, foliage and street-furniture construction yield between short work slices. Furniture prototype preparation runs before cloning; texture/model downloads use the existing bounded queue.
- Rigid bicycle siblings are batched with shared, reference-counted geometry. Articulated wheels, steering pivots, style nodes and grip sockets stay separate. Repeated spine-fitting queries are reduced.
- Static batches no longer clone geometry for singletons. Auto distance/resolution adjustments skip unchanged material/texture processing.
- Generic downtown facades use a local ground datum and complete window bays/rows. Foundations extending down banks use plain masonry, not windows. Tall buildings no longer repeat ground-floor shop doors on upper floors.
- Original building collision envelopes, footprint positions and roof heights are preserved. The facade fix is shared through the scenery used by both games.

## Verification

- Ride-core and client TypeScript checks passed.
- Focused regression suite passed: bicycle fitting on shipped skeletons/styles, rigid-batch ownership/transforms, cooperative work scheduling, GPU warm-up ordering, facade UV/ground alignment, bridge/ramp clearance and riding, static batching, interior budgets, bounded asset loading.
- All riding-game outputs rebuilt with the existing local build pipeline.
- Browser: Swoop title → menu → ride and Royale title → lobby → AI practice reached gameplay. No console errors or warnings in checked logs.
- Swoop Atwater facade screenshot: ../../../../../../output/performance-audit-20261018/facade-fixed.png (absolute output folder is C:/Users/digit/Documents/phone/output/performance-audit-20261018).
- User clip inspected through extracted frames across its 59-second duration; the ground-floor/roof cropping matches the previous world-height UV mapping.

## Measurements and limits

- Final sampled desktop Swoop first-playable: 21.0 seconds; startup UI reported 21.8 seconds. Includes 1.56 seconds of explicit first-view GPU preparation. Earlier audit reported 15.7 seconds before readiness was moved past GPU preparation; these are not equivalent readiness boundaries, and no faster-loading claim is made.
- Royale sampled ready time: 28.4 seconds. The startup-hidden frame profile was absent, consistent with rendering being gated.
- Busy Cut sample still showed about 45 FPS with 33.4 ms p95 at manual HD. Royale ten-rider practice sample showed about 39 FPS/33.4 ms p95 at the larger default viewport. Camera, actor positions and viewport varied; these are observations, not a controlled speedup claim.
- Sustained 60 FPS, iPad loading/memory stability, and all-route visual approval remain unverified. GPU warm-up does not guarantee hitch-free video decoding on physical devices.
- Automatic graphics preference and normal browser viewport restored after the test. Local Swoop and Royale tabs remain available for review.
