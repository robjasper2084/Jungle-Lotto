# Ground and stair measurements

This audit reads the exact staged build from PR #213 head `61a9db36df072850f4bcea4536471e3d92e07453`. The workflow verifies the compiled ZIP before extraction. The audit additionally checks 27 transitive terrain source blobs, the original map blob, manifest SHA-256, legacy landmark SHA-256, every sampled staged GLB hash, and the locked Three.js version.

The Aquarium audit samples all four outside treads, the landing and all three raised inside treads at four lateral positions in each of the three LODs. The 120 measured top surfaces match the unchanged game support height within 0.000000024 metres. The check uses the highest upward-facing surface in a bounded ray interval; it does not select whichever overlapping surface happens to be closest to the collider.

The Conservatory audit includes both the staged facade and the explicitly retained legacy paving. Each LOD is measured at the original 25 entrance points plus an independent 29 by 17 grid over the threshold footprint: 518 points per LOD, 1,554 total. Every point has retained paving. The original 25 points are clear of standing collision. The legacy floor is already 7–8 cm above the unchanged terrain support. The near LOD's threshold adds at most 1 cm; the two distant LODs omit that threshold while keeping the continuous original floor. Lowering only the threshold by 8 cm would bury it under the original paving and would not repair that pre-existing support difference.

The Node loader substitutes empty image textures solely to decode the existing Meshopt geometry without a browser. Position data and transforms are retained and recorded. No image, material, model, geometry, terrain, actor or collision is changed. This CPU audit cannot certify visible shoe or tyre clipping, complete route clearance, surveyed site elevation, a native screenshot, or runtime performance. The separate native entrance/contact and original ninety-second checks remain authoritative for their own scopes.

Run with Node 24 and the pinned application's locked dependencies:

```sh
node --experimental-transform-types audit-ground.mjs /path/to/application-checkout /path/to/verified/dist /path/to/output
```

The complete raw measurements, source receipts and model bounds are written to `ground-audit.json`. A previously recorded failure is never rewritten by this inspection.
