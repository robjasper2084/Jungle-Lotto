# Controlled Aquarium roof comparison

This is an additive native Metal diagnostic for the estimated Aquarium study in PR #248. It compares exact before commit `bf2fa1eaef4c529e8428f2ac1d0ac5a897a1e112` with exact roof candidate `c7461c7c095cfb19ba8770b343952adb6eda5624`. The sole intended model change is the two copper end closures, adding 54 vertices and 50 triangles to the existing roof primitive in each of three LODs. Existing vertices, indices, materials, placement, height/profile, collider inputs and shadow policy remain authoritative.

## What the images mean

The fixture calls each commit's unmodified `createWorld` factory, with the complete immutable original asset context. It uses the four exact desktop camera matrices retained by public-input gallery PR #245 at `aef6e04`: Aquarium front, rear and east oblique, and Conservatory south. It assigns those matrices only to its own diagnostic camera. Float32 view/projection/position bits are checked both directly and by the unchanged original read-only renderer observer. The Aquarium transform and LOD0 submission are also binding.

These images are **controlled world renders**, not native walking or full gameplay screenshots. The fixture does not construct `main.ts`'s HUD, player/companion/vehicle controllers, online riders, race or photography layers. Those public-input views were first person with a hidden player, but that does not make this separate fixture identical to gameplay. The original world factory retains its own distance culling and LOD rules; the original near-view update and `prepareCadillacLandmarks` complete its queued scenery preparation, with loaded playground/Yacht Club state required. Distant optional detail outside original prefetch ranges is not forced into view. Actual preparation statistics, complete object inventories and every fetched asset are retained.

Both variants use a fresh context, the same explicit Mulberry32 construction seed and fixed wall-clock date, the same declared simulation samples, High quality, noon, clear sky, reduced motion, 1280 × 800 and DPR 1. The original automatic hardware-antialiasing policy and actual context attributes are recorded. Source PCF shadow policy and the first native scheduled shadow pass remain intact. `performance.now`, browser scheduling and GPU fences stay native. There is no frame-rate, 90-second performance or collision-acceptance claim.

## Binding evidence

The workflow checks the before/candidate commit and tree, tracked source cleanliness, the original observer/server Git blobs, and all six active staged GLB hashes. It retrieves artifact `15149060140` from run `45882624790` once and retains that original ZIP in the output. The archive is pinned to SHA-256 `6d244cd0bf5c5564af1e4790bab5605493f887d4686eaa0640386b3d6eb80559`, 176,931,003 bytes, 209 ZIP entries and 245,935,956 extracted bytes. Every CRC and safe archive path is verified. Both modes serve the same extracted files; candidate overlays only its three reviewed Aquarium GLBs. Original application bundles are not edited or executed.

The isolated Vite build records every module's bytes, SHA-256 and Git blob, including original literal `new URL(..., import.meta.url)` assets that Vite can inline without a module callback. Every bundled tracked application input is checked against its exact source commit. Across the two module graphs the only permitted source difference is `stagedLandmarkStudies.ts`, independently restored by replacing the three candidate hashes with their before hashes. The diagnostic commit, source files, workflow, compiled bundles and source receipts are copied into the output before native work. Current and archived workflow/source/commit bytes are independently reverified afterward.

Transparent observers retain the original loading-manager returns and compiler Promise identities. A bounded preparation boundary requires no pending loads/compiles and 500 ms without new work, then uses the original world update to publish ready scenery. The exact original Detroit prop plan, source GLB and prototype primitive counts also bind a unique visible published scene group with all expected category/instance totals; a temporary hidden shader-warmup group cannot satisfy it. This handles the original synchronous shader compiler's asynchronous completion polling, which a quiet network alone would miss. The scene and activity counters must remain stable across captures.

For every view, the verifier requires all constructed world objects, non-roof vertex/index/instance streams, material properties, texture configuration/source identity, transforms, visibility, draw order, callbacks and shadow settings to match. Only the three original roof geometries may differ: their old 96-vertex and 144-index prefixes must remain exact and the new totals must be 150 vertices and 294 indices. Roof material and shadow state must match. Native direct color/shadow submissions retain their order and counters; each submitted roof draw adds exactly 50 triangles. The full-detail roof must actually appear in color and in the retained preparation shadow pass. Missing asset responses, failed native submissions and incomplete inventories remain failures.

Each variant/view produces two frozen original-resolution PNGs and bottom-up RGBA readbacks. `gl.readPixels` and `canvas.toDataURL` execute synchronously in the rendering task, preserving the original `preserveDrawingBuffer: false` context. A native fence confirms completion. The independent PNG decoder verifies CRCs, filters, dimensions and exact top-down channel equivalence to the original GL bytes, with every original alpha byte 255. Repeated frames within the same variant must match exactly, and the world inventory must remain unchanged throughout them.

The roof crop is a declared projection of the union roof bound with 12 pixels of padding. Crops preserve original decoded channels without resampling. Absolute RGB difference images and statistics include the entire frame and explicitly count differences outside the crop; new closure faces can legitimately change local occlusion, reflected light and cast shadows. **Before/after pixel equivalence is not asserted.** Human review remains required for the change. Historical facade detail, real-world height, architectural acceptance, original entrance/contact gates and original sustained-performance gates remain separate and unchanged.

## Running and reviewing

The new workflow is restricted to the dedicated diagnostic branch targeting the roof candidate. It has only the diagnostic directory and its own workflow in its path filter. It builds each pinned source separately and runs one native Metal comparison on macOS. It makes no source, model or original gate edits. Each native variant has an aborting 13-minute context deadline; a timed-out page operation cannot overlap the next capture. Successful and failed evidence is uploaded.

Focused portable checks:

```sh
node --test .github/diagnostics/pr248-roof-compare/contract.test.mjs .github/diagnostics/pr248-roof-compare/provenance.test.mjs
node --check .github/diagnostics/pr248-roof-compare/driver.mjs
```

The production roof's focused geometry tests are part of PR #248; this package tests the additional evidence verifier and fixture contracts. A successful diagnostic means the paired observation is complete and internally conserved. It does not approve the appearance or clear any existing failed native gate.
