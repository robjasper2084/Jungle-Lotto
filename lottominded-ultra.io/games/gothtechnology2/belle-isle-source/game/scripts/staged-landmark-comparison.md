# Staged landmark matched native comparison

This additive companion builds the default and opt-in staged scene at the same
exact Git head and tree, then captures the actual game through its existing
public Guide controls. It changes no application source, actor state, camera
state, geometry, collider, original portal/contact test, or ninety-second
performance gate.

Run from game/ on macOS with the existing locked game and sibling Playwright
dependencies and native Chrome installed:

    STAGED_COMPARISON_SOURCE_SHA="$(git rev-parse HEAD)" STAGED_COMPARISON_LAYOUT=desktop node scripts/staged-landmark-native-comparison.mjs
    STAGED_COMPARISON_SOURCE_SHA="$(git rev-parse HEAD)" STAGED_COMPARISON_LAYOUT=phone node scripts/staged-landmark-native-comparison.mjs

The separate workflow runs both layouts on actual Metal. No software-renderer
fallback is allowed. Desktop is 1280 × 800, High, 60 fps cap; compact phone is
390 × 844, Smooth, 30 fps cap. Both use DPR 1, reduced motion, a foreground
document, clear noon with the sky cycle disabled, and the normal One wheel ride.
These are viewport comparisons, not physical-device performance certification.

## Six paired views

Each mode uses fresh browser storage and the same public actions. Native F and V
keys select the normal walking and camera modes. Settings use trusted native
keyboard selections; both input and change events are retained. The companion does not apply
movement keys or claim an entrance crossing; the separate unchanged walk test
provides actual portal trajectories and collision contacts.

| View | Existing public action | Camera and actor mode |
| --- | --- | --- |
| Aquarium exterior | Travel to entrance | TPP, mounted |
| Aquarium entrance view | Same Travel anchor, native F and V | FPP, on foot outside the entrance |
| Aquarium interior | Explore aquarium on foot | FPP, on foot at the public interior anchor |
| Conservatory exterior | Travel to path | TPP, mounted |
| Conservatory entrance view | Same Travel anchor, native F and V | FPP, on foot outside the entrance |
| Conservatory interior | Explore Palm House on foot | FPP, on foot at the public interior anchor |

## Source and runtime evidence

Both modes bind the same twelve source GLB SHA256 hashes and byte lengths from
the checked manifest. Staged builds must contain those exact twelve assets.
Default builds must exclude all twelve and the staged manifest. Runtime evidence
is independent of those build labels: default must retain the audited original
facades, have no installed staged roots, and make no staged asset requests.
Staged mode must install both three-level LOD roots, select full-detail LOD0 at
the captured sites, remove the four audited original facade groups, retain the
six audited interior details, and load the exact six active model GLB byte
streams. The additional six study assets remain packaged but inactive.

Receipts include the checkout head/tree, compiled JavaScript/CSS and built
manifest/index hashes, twelve source hashes, actual model response hashes,
native browser/renderer, viewport and context attributes, settings, trusted
input events, actual effective quality/render scale/cap, bounded scene inventories,
and the PNG hash and dimensions.
Actual loaded node names are preserved, including GLTFLoader's underscore
normalization; normalization is used only for matching the authored names.

The normal build rewrites the tracked street-detail diagnostic's buildMs.
Before building, the driver retains that file's exact original bytes. Afterward
it requires every other parsed JSON field to remain identical, records both
byte hashes and timings, and restores only those verified original bytes.
Any other tracked change still fails the exact-source check. Compiled asset
receipts are captured separately after the normal build.

## Exact camera comparison

A pre-load, observation-only Three renderer hook forwards the existing
render and renderBufferDirect calls once, with the original receiver,
arguments, return value, and exceptions. It captures matrices from the actual
camera argument of every onscreen color submission, after Three has updated its
camera matrices. Native draw counter conservation covers batched and instanced
submissions and the original shadow pass. Missing coverage, a different camera,
changed targets/matrices, or lost hooks fails the receipt.

The driver waits for six consecutive fully observed island passes with identical
GPU camera inputs. It then uses the original GPU fence, two paint opportunities,
and existing CDP compositor-PNG helper. Camera inputs and object identity must
remain stable across each capture, with another actual observed frame afterward.

Across builds, matching requires exact equality of the Float32 view matrix,
projection matrix, and world camera-position bit patterns. The four raw camera
matrices, raw world position and projection parameters are also retained.
Sub-Float32 raw differences are not silently discarded from the report.
Scene/object identifiers are checked within a run but are not compared across
builds because allocation identities are not stable.

This is **not** equality of every per-object GPU uniform. Three also computes
per-object model-view matrices, and the compared architecture intentionally
changes. It is not pixel equality: the purpose of the paired original/repaired
images is to expose the intended model changes for inspection.

## Reading the result

The output/staged-landmark-comparison/&lt;layout&gt;/index.html page shows
the six original and repaired pairs. Its comparison.json binds both mode
reports and exact camera comparisons. Each mode retains all six original
compositor PNGs and its complete build/runtime receipts.

An automated pass establishes source, mode, camera and capture equivalence.
The manualVisualReviewRequired field remains true; appearance, overlap,
collision and performance acceptance fields remain null. Inspect the actual
desktop and phone PNGs before accepting facade overlap, silhouette, entrance
appearance, interior visibility, or clipping. The original native portal/contact
and strict ninety-second full-scene gates still need their own successful evidence.

Contract checks use built-in Node test tooling:

    node --test scripts/landmark-comparison-observer.test.mjs scripts/staged-landmark-comparison-contract.test.mjs
