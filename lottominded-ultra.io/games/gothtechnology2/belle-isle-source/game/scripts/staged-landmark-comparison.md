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

After trusted native Start and all settings selections, the driver requires a
currently valid complete island pass with fresh counters and intact hooks. It
then arms a **one-shot capture window**. The boundary records the native frame,
observer sequence, timestamp and lifetime preparation-failure count. It cannot
be reset or armed again. The report binds that boundary to the native Start and
settings events before it, and every Guide action after it.

Preparation failures remain in the lifetime counters and the first eight failed
pass receipts, even after later valid frames replace the short settling history.
The first eight capture-window failures are also retained separately. Any invalid
pass after arming is fatal for the whole comparison, including intervening Guide
transitions. Setup errors, missing hooks and stale/incomplete passes are never
cleared by arming.

The driver and independent report contract require six consecutive fully observed
island passes strictly after that boundary, with identical GPU camera inputs.
It then uses the original GPU fence, two paint opportunities,
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

## Retained first-run harness failure

The first phone comparison on `df52f1ba` (run `45862457527`, job `140067049393`)
failed before any capture. Both modes completed normal startup and native Start
without application or request errors. Each observer recorded one lifetime
invalid pass, followed by more than 4,100 valid complete passes. The previous
readiness rule remained false because it treated every preparatory observation
as part of the later capture window. The first invalid row had already been
evicted from its last-eight-pass history, so this artifact cannot identify that
row's exact issue or place it on either side of the Start event.

That failure remains retained as artifact `15140309037`, SHA-256
`6da1fc3aefc1bc43a2ad7beeb0d0c6293a49a198967cdd9408104266e95e4d63`.
The boundary repair changes only this additive observation harness and its
report validation. It does not claim those failed runs passed, change the game,
increase any deadline, or relax a capture-window camera/coverage condition.
All 38 observer/contract checks pass locally; fresh native captures are still
required before any visual acceptance.
## Native desktop select correction

The preserved 9b43 desktop comparison stopped before arming or capturing: the real sky preset stayed empty and no input/change event committed Midday. The same source/Chrome/Metal run with phone emulation completed all six matched pairs. Chromium routes arrow keys into the macOS native popup, while printable label typeahead on a closed select commits the actual selected option and native input/change events.

The driver now reads the real enabled option labels, finds an unambiguous printable ASCII prefix, blurs with native Tab to reset the typeahead session, and types the prefix through Playwright's native keyboard path. If the target is already selected, it visits another actual option first so the final input/change receipt remains required. It does not assign the DOM value, dispatch synthetic events, use selectOption, alter the game sky API, or replace the control.

The original exact final value, noon/clear sky, High/Smooth quality, DPR/scale, frame cap and trusted-event checks remain. A/S character keys are allowed only in the open settings dialog during configuration; settings keys after the one-shot capture boundary and every gameplay movement-key offset remain fatal. Option labels, selected values, native key/input/change events and configuration timestamps remain reviewable.

Primary implementation references:
- Chromium HTMLSelectElement default/typeahead handling and native blur reset: https://chromium.googlesource.com/chromium/src/third_party/+/2067f23a5ed6f53f730ad66bd94a922a5555326e/blink/renderer/core/html/forms/html_select_element.cc
- Chromium menu-list keyboard dispatch: https://chromium.googlesource.com/chromium/src/+/be1eea1988a795d542b829e90f4938aebab154c6/third_party/blink/renderer/core/html/forms/select_type.cc
- macOS arrow-key popup policy: https://chromium.googlesource.com/chromium/src/+/4b002a419dcb3e927aa998f402205663d720953b/third_party/blink/renderer/core/layout/layout_theme_mac.h

Native execution of the corrected helper is still required. The old failed report is retained; it is not reclassified as a passing capture.


## Saved signed-zero camera receipts

JSON represents both numeric signed zeros as `0`. The Float32 camera bit arrays are retained as exact unsigned integers, so a saved report can still distinguish `+0` and `-0`. Validation now permits only that serialization loss in the redundant raw/Float32 numeric arrays. It does not rewrite the report, change integer bit arrays, introduce a numeric tolerance, accept a nonzero mismatch, or allow nonzero underflow to borrow the zero-sign exception. Every cross-build camera bit comparison remains exact, including the sign of zero. The preserved 9b43 phone reports replay directly with their original bytes and all six pairs intact.
