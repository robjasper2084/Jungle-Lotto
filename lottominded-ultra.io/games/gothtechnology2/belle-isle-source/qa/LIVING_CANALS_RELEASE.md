# Living canals and shore — release evidence

This stacked PR is **not production**. PR #172 owns underlying geology, roots,
sediment and bridge weathering. This PR adds quality-budgeted wetland reeds,
fallen limbs, gentle crown lean, an optional first waypoint, wet limestone finish
and under-arch ambient material shading without moving roads, collision or terrain.

## Four genuinely matched reference views

The PR's Belle Isle matched environment gallery workflow runs the existing
browser guide-travel capture for candidate and published baseline, on both
desktop (1440x900 High) and phone (390x844 Smooth), at noon and sunset.

1. MacArthur bridge shoreline
2. Wooded canal
3. Red pedestrian bridge / Casino area
4. Swimming beach

The gallery's current wooded-canal and red-bridge guide destinations are
**provisional framing points**, not proof of exact photographic composition.
Compare the screenshots side by side, and reject captures that do not show
the actual intended waterline or red bridge. Each report identifies the guide
destination and recorded frame evidence. The workflow does not insert fake
screenshots or modify camera pose.

## Safety and performance acceptance

- Confirm a first ride from Jefferson leads to a clear dismissible destination.
- Compare first-person, low third-person and split-screen views.
- Confirm bank detail does not obstruct paths, beaches, arches or race routes.
- Check collidable geology from PR #172 using the existing collision suite.
- Run exact-head TypeScript, full tests and build; accept all required PR CI.
- Compare browser frame-time p50/p95/p99, draw calls, memory, loading and
  scenery transitions to the published baseline. For physical mobile FPS,
  repeat on real mobile hardware; SwiftShader screenshots do not certify FPS.
- Suggested thresholds: no more than 10% p95 regression desktop or 15%
  mobile, with no additional severe hitching. These are review gates, not
  performance measurements or achieved results.
- Validate remaining vehicle acceleration, braking and recovery in play;
  this pass deliberately avoids speculative physics retuning without a
  reproducible reference.

No merge, production publication or FPS certification is implied.
