# Pinned full-desktop stall attribution

This isolated diagnostic investigates the original PR #246 full-desktop failure: one **349.5 ms** accepted frame at **Belle Isle · MacArthur Bridge island landing**, x `431.46781449328233`, z `779.3329324177877`. Its original p95 was 48 ms, but the unchanged zero-frames-over-250-ms gate failed. A passing instrumented run cannot clear that failure, replace acceptance, or approve a release.

## Exact inputs

The application checkout is the tested merge `f7c008b14e391b9c07ea1f52fd913eb475f7b17e`, whose tree `7648674a8c7f8af0f274b7fade51bf446e55ce4a` equals candidate `35895107296ea44ea4ccdac36072f98e3f3eea84`. Restore the original compiled artifact from run `45901286856`, artifact `15156381621`, name `sustained-profile-game`, 176640312 bytes, ZIP SHA256 `2531e9b423bb49c54212f1a0b75e7449f0bb79a69509e99899ba76cef69d8c9e`. If it has expired or any metadata/hash differs, fail. Do not rebuild or substitute it.

Execute the original `scripts/sustained-ride-profile.mjs` directly with a separate Node `--import` preload. Its immutable Git blob is `c722b5810a7693e5ece72ed00b4401e7cde7267a`. No derived driver is generated. Source files, generated bundles, URL, full scene, native input, heartbeat, 90-second wait, launch flags, original deadlines, High quality, cap60, DPR1, scale1, 1440 × 900 viewport, GPS actions/assertions, original report and original process exit remain the originals.

The application and diagnostic code use separate checkouts. The workflow records the diagnostic commit and tree independently and gives the original driver the actual tested application SHA. Every tracked diagnostic source file and the workflow are archived with their exact Git blob, SHA256 and byte length; the clean diagnostic checkout and archived bytes are verified again after execution. Archive paths avoid hidden-directory filtering. The already-verified input ZIP is retained as `evidence/immutable-input-build.zip`, and its hash is checked again after the run. Signed download URLs and credentials are never saved to evidence.

Artifact receipts and diagnostics stay outside `dist`; the complete compiled inventory and clean tracked application source are verified before and after the run. Browser-consumed JavaScript response bodies are matched to that inventory.

## Observation lifecycle

The preload observes the original desktop game page, separately from the capability probe and later GPS contexts. Read-only native input listeners add PerformanceMarks and retain timestamped RAF gaps, long tasks, and supported long-animation-frame entries. They never replace game state, input dispatch, clocks, RAF, WebGL, rendering, sensor providers, or application methods.

The original Locator factories remain synchronous and return the same native objects. Trace and CPU sampling are armed immediately before the original **Start 10-minute capture** click. The original click still executes once with its native receiver, arguments, result and errors. Observer setup failures remain diagnostic failures and do not substitute input.

The key-release observer returns the exact original `keyboard.up('w')` promise. Once it fulfills, CPU stop and trace end are requested immediately. There is no added held-input delay and no artificial work to create a post-release CPU sample. Stop/snapshot work is distinct from raw stream flush and final report binding. The original GPS sequence continues; original context closure joins only target-dependent stop/snapshot work. Browser closure joins remaining raw flush and binds the report already written by the original harness.

Trace recording therefore ends at the original trusted W release rather than continuing through the lengthy GPS tail. Every pending stop, raw read/write, file-close and CDP-handle-close error is retained independently. Raw or partial trace/CPU files remain archived even when parsing or validation fails. Trace JSON is scanned incrementally, with every byte hashed and every event parsed; it is never converted into one enormous string.

## Evidence and duration rules

Required categories are requested even when Chrome returns an empty category listing. Collection completeness depends on actual emitted evidence: unique native clock markers, their renderer process/thread, positive-duration renderer work across the native boundaries, signed CPU sample reconstruction, browser/GPU process activity observations, and a complete trace stream with no reported data loss. Raw negative CPU deltas are preserved without clamping, sorting or interpolation. The published `bf2fa1e` accumulator's stricter first/last actual-sample coverage predicate remains unchanged; its expanded raw CPU and browser/GPU observations are retained.

The trusted native first-W-to-keyup interval must be at least **90000 ms**. Eligible active seconds and excluded seconds are distinct reported values. This deliberately does not inherit `bf2fa1e`'s additional `activeSeconds >= 90` diagnostic condition: the real 5949 capture held W for 90013.8 ms while reporting 89.9997 eligible active seconds. The original riding gate and native 90-second duration remain unchanged.

Stopping immediately after release can leave the final CPU sample before keyup even when the CPU header ends later. That remains an explicit **incomplete coverage** result. Do not waive it, use header bounds alone, change the input duration, or add a long delay to hide it.

The original process status is saved before the separate evidence validator runs. Collector errors never set the original process exit code. The workflow preserves an original nonzero exit; if the original driver passes but evidence is incomplete, the diagnostic workflow still fails. `releaseAcceptance` is always false. Instrumentation overhead and available process events prevent this experiment from serving as uninstrumented performance acceptance or GPU-execution certification.

## Local verification

Set `STRICT_DRIVER_PATH` to the exact original script, then run `node --test observer.test.mjs sustained-trace-json.test.mjs source.test.mjs`. Tests cover native factory/click/release semantics, original gate parity, arm/stop/GPS ordering, pending error retention, partial-stream cleanup, immutable pins, actual event/sample evidence, native input duration and diagnostic source/ZIP preservation. Reader tests cover full JSON syntax, chunk boundaries and complete-file hashing. The unchanged reader has also replayed the real 733328428-byte, 3960323-event #213 trace with the published bf2 accumulator, matching every byte hash and independently checked numeric field; that offline replay does not change the historical workflow failure or establish the desktop stall's cause. Local Chrome launches are intentionally excluded; the separate CI diagnostic must establish its own native event shape and timing.

Only this directory and `.github/workflows/belle-desktop-stall-attribution.yml` are part of the change. To keep acceptance workflows isolated, publish with a PR diff containing only those new paths; the application is already pinned independently.
