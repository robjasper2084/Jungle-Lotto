# Belle Isle Explorer — Cinematic Performance Pass 2

Status: **stacked candidate** on PR #160 (`feature/belle-cinematic-performance-pass-1-20261115`), NOT yet merged or publicly deployed.

## Scope: targeted rendering, co-op and startup changes

### High/Automatic shadow budget
- 2,048px single directional shadow map is reduced to 1,536px in High and 1,024px in Automatic. Smooth retains contact shadows and skips the dynamic shadow pass.
- Named architectural landmark shadow casters are restricted to the rider's neighbourhood (High 110m, Automatic 85m, with mesh radius and a 12m hysteresis guard). Geometry, sky colors and collision remain unchanged.
- Local ground-contact shadows and the authored cockpit/vehicle materials are preserved.

### Co-op: one clock, multiple eyes
- Shared coast-guard movement/lights, lamp night intensity, water sky lighting, and garden/waterside wind are updated once per animation callback, not once per rendered player pane.
- The sky's existing volumetric update guard now also covers shared sky-life, atmosphere, aircraft and reflection presentation work. Per-view world visibility, water positioning, camera matrices, local lights, player physics and culling still run independently.
- In 2-player co-op on coarse-pointer/mobile devices, use existing contact shadows rather than repeatedly rendering the directional shadow map. Desktop two-player mapped shadows remain. Three/four panes already used contact shadows.

### Startup: approach-loading optional assets
- Yacht Club's 8.14 MB GLB is no longer forced into desktop startup; existing 1,550m approach detection and explicit guide preparation still load it.
- Golf Center, reference architecture and playground visuals are prepared off-scene on approach, then their textures/shaders warm before being shown. They no longer block the initial spawn. Their map landmarks and preexisting collision footprints remain active.
- Keep waterfront detail, skyline and core landmarks in the initial visible scene; do not strip map detail or change rider spawn.
- Retry optional visual loads only after leaving and reapproaching; never send one request per frame. A failed optional visual transfer must not block riding.

## Validation required before merge
1. `npm ci && npm run check && npm test && npm run build` from `belle-isle-source/game`.
2. Play co-op on desktop and touch: P1 and P2 far apart, three/four panes, independent cameras, cockpits, mapped/contact shadow mode, stop/return to solo.
3. Startup browser screenshots at the island spawn; confirm that the Yacht Club, Golf Center, reference structures and playground equipment load before becoming visible upon approaching or teleporting. Capture road/landmark/bridge and screenshot lighting differences in High.
4. Capture 10-minute `?profile=1` rides at matching camera, sky, route and device preset before/after. Record actual frames, p50/p95/p99, submitted triangles, shadow render calls, GPU memory and network resource timing.
5. Compare actual *High* shadow artifacts vs the original 2048 map. Verify all source unit, cinematic, polish, startup, co-op and production Pages checks on the exact stacked candidate.
6. Do not rebase or merge this stacked candidate directly to production until PR #160 has been separately completed and the new exact integration tree has passed all release gates.

Goals are improvements in shadow submissions, co-op CPU work and startup transferred bytes, **not measured speedups yet**. Desktop 60 FPS/mobile 30 FPS remain targets, never guarantees.
