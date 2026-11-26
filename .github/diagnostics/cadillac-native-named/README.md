# Named native rendering attribution — diagnostic only

This workflow builds application commit `75906273c0cd414c0d004320fc6f654b4783e5b1` plus the two-file observation patch in this directory. It collects bounded object/material draw labels together with the existing CPU samples. It is **not native acceptance**, and no result from it replaces the unchanged strict candidate checks.

## The source change

`application-diagnostic-only.patch` changes only two expressions in the application:

1. `createNatureRenderProbe` accepts the additional exact opt-in `profile=1&renderSubmission=1`, beside its existing `profile=manual` mode.
2. `main.ts` continues to create the manual loop/pacing observer only for `profile=manual`. The additional opt-in enables the existing nature and render-submission probes without enabling that separate observer.

Ordinary `profile=1`, ordinary gameplay and existing manual mode retain their behavior. The diagnostic still uses the original trusted W-keyup boundary. Its build reader remains on the original `profile=1` path and does not request the manual build-marker URL. The patch changes no frame acceptance, quality setting, input, geometry, scene contents, light, shadow or GPU pacing decision. The enabled CPU observers add work, so their measured timings cannot serve as release acceptance or GPU execution timings.

The original strict driver remains the Git blob `c722b5810a7693e5ece72ed00b4401e7cde7267a`. `belle-cpu-observer.mjs` derives a separate script from that pinned original. Compared with the existing #232 CPU-derived script, its **only driver change** is `/?profile=1` → `/?profile=1&renderSubmission=1`. Exact reverse derivation is checked before writing the separate script. The original observer used for this comparison is the unchanged Git blob `007ef71a678d52e103492d5c4ecf74f38c3150af`.

## Build and source receipts

The workflow checks out the application at the immutable base and checks out this bundle at the exact diagnostic pull-request head. It verifies the original file hashes, applies the reviewed patch, records the exact resulting Git source tree using an isolated temporary index, and makes a fresh locked build. It does not reuse the old #232 application artifact.

Artifacts retain the base commit and tree, diagnostic revision, patched application tree, reviewed patch, actual source delta, before/after SHA-256 receipts, original strict driver, derived driver, helper, focused test log, typecheck log, build log and a SHA-256 manifest of every built file. The manifest is checked on the native runner before and after capture. The strict driver is checked again after capture.

The normal build may regenerate `research/street-detail-stats.json` with a different `buildMs`. The provenance gate allows only that exact non-runtime timing field after proving every other field equal, and archives both the resulting statistic and the complete post-build tracked delta. Unexpected source or asset changes fail the job.

The raw report's `sourceHead` identifies the **diagnostic revision**, not an untouched application candidate. `source-provenance.json` separately identifies the pinned application base and exact patched application tree. `after-build-verification.json` ties the fresh build to that tree. This distinction is required when interpreting or citing the report.

## Native capture and evidence validation

The macOS15 job uses the original Chrome/ANGLE Metal launch, desktop viewport, high/full settings, genuine keyboard input, 90-second hold, GPS checks, frame measurements and original `p95 <= 50 ms` / zero `>250 ms` tests. It preserves the raw report, original failed classifications, driver exit code and log. A failed performance report is evidence, not a successful release result.

The separate evidence validator requires the exact diagnostic revision, native Metal, desktop/full/90-second settings, trusted W-keyup, the original GPS result, high settings and pixel ratio1 at both capture boundaries, no reduced scene, absence of manual-loop diagnostics and the unchanged nonmanual build-reader result. Both boundaries must show installed direct-draw and scene-matrix hooks; measured callbacks and bounded named draw rows must be present. Partial coverage of additional GL hooks stays explicit. CPU samples and at least the original90-second input-hold window are required independently.

Named direct-draw measurements include nested GL work and observer overhead. Do not add overlapping timings or interpret them as GPU durations. A callback's rendering duration does not by itself identify the cause of the following frame gap.

## Focused verification

Seven tests cover exact reversible driver derivation, original observer/driver pins, preservation of raw failed results, rejection of missing evidence, precise query opt-in, the actual application initializers, the untouched RideProfile trusted-input boundary, and nonselection of the manual build-marker request. These tests run against the patched application source and its unchanged dependencies.

For a separately checked-out application with this patch applied:

```sh
APP_GAME=/absolute/path/to/game \
DIAGNOSTIC_SOURCE_ROOT=/absolute/path/to/game \
STRICT_DRIVER_PATH=/absolute/path/to/game/scripts/sustained-ride-profile.mjs \
node --test observer-derivation.test.mjs render-probe-gate.test.mjs
```

Then run the application's existing `npm run check` and `npm run build`. The workflow performs these focused gates and does not repeat unrelated feature suites.

## Publication layout

Place this directory's nine review/helper files under `.github/diagnostics/cadillac-native-named/` and the supplied workflow at `.github/workflows/cadillac-current-native-cpu-attribution.yml` on the existing #232 diagnostic branch. The workflow copies this bundle separately from the pinned application checkout. The acceptance application candidate remains unchanged.
