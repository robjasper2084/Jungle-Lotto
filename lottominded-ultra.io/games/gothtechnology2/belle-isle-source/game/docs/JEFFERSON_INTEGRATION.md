# Selected Jefferson building assets

This candidate assigns original Higgsfield/Blender artwork to two existing mapped buildings and adds two slender signs. The game map, heights, road geometry and collision registrations stay unchanged. The assets are fictional designs, not surveyed replicas or Street View image transfers.

## Runtime selection

| Existing ID | Design | Existing height | Runtime root |
| --- | --- | ---: | --- |
| `detroit-38139` | DIGITAL STATIC workshop | 6.8 m | `JEF_detroit_38139` |
| `886253052` | RIVERFRONT MARKET | 9.9 m | `JEF_886253052` |

`jeffersonPlacements.ts` is the explicit allowlist. Each assigned root is authored for its exact target and cannot be reused on a different ID. The original prototype-index mapping is retained for every other building. Both selected fronts face Jefferson with their existing yaw.

The workshop follows its concave footprint; the market follows its four-corner footprint. Their geometry compensates for the existing fit function's 0.98 rectangle margin. Bases use the original footprint's first terrain sample, matching the unchanged collider base. Do not normalize these adapted roots again or apply the old generic −0.05 m visual offset.

`jeffersonAssetSkins.ts` verifies target metadata, current dimensions, finite static mesh data and transformed vertices against the active footprint before accepting a model. The real-file test also checks complete projected triangles, required material maps, image bytes, normal/UV data, exact lettering positions, and the submitted geometry budget.

The building pack has 13,160 triangles in 17 material batches. The sign pack has 1,660 triangles in six batches. Their PBR materials remain scoped to these assets. The runtime package separates the original PNG bytes from the GLBs without changing their pixels, geometry or material assignments.

## Publication and fallback

The selected and original buildings share the existing awaited preparation queue. Textures and shaders warm off-scene before the combined stage publishes. The mapped fallback remains available during preparation or failure. The normal 240 m cells and 405 m building visibility boundary are retained. The two new signs use a 140 m visibility distance and the existing scenery preparation queue.

Signs are metre-authored visual details. Loading validates mapped land, existing obstacles and clearance from both park and district road/path records. Their positions add no collision registrations.

Selected assets are enabled in ordinary candidate builds. Set `VITE_JEFFERSON_ASSET_SKINS=0` **at build time** to produce the comparison build with the original street art. This switch changes only the selected Jefferson presentation. The native sustained workflow uses its existing ordinary build and therefore measures the enabled candidate.

## Evidence and review

The query `?jefferson-gallery=1` exposes a read-only snapshot of actual player/camera state, renderer and asset publication. It provides no repositioning API and refuses to expose a real location-following session. It is absent in ordinary sessions and does no extra work in the render loop.

`scripts/jefferson-asset-gallery.mjs` uses real UI and trusted keyboard, mouse-joystick and touch controls to reach the selected buildings. The existing Guide travel action shortens the route to the west market. It captures facade/corner, ground-level roofline and sign detail, checks active frames and a real GPU fence, and records exact camera/pose and replacement/proxy state. A separate baseline build uses the same routes. Pairing is accepted only after the actual recorded camera values are compared. Successful capture alone is not visual approval.

The dedicated gallery workflow runs desktop and phone viewports in native Chrome on macOS Metal. The phone is an emulated viewport. Local browser installation was unavailable in the authoring workspace, so native run artifacts are the required game evidence.

A native review of the prior candidate found fragile, near-coplanar sign lettering. The revised export provides about 10 mm glyph depth and at least 18 mm front-to-fascia clearance, without altering footprint, height, material definitions or original texture bytes. Its real-file regression also checks outward caps and backing-wall clearance. Current native screenshots are required to accept the revised rendering.

The existing sustained workflow, its 90-second requested windows, graphics settings, trusted input capture, heartbeat, GPS checks, p95 limit and stall limits are unchanged. Gallery runs do not substitute for them. See the draft PR's exact-head workflow results and the separately retained review report before release.

Related records: `JEFFERSON_PLACEMENT_AUDIT.md`, `JEFFERSON_GALLERY.md`, and `docs/jefferson/` geometry/provenance reports. The original embedded source GLBs and editable Blender source are retained with the asset deliverable.
