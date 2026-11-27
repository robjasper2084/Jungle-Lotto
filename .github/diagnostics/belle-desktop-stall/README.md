# Pinned staged full-desktop attribution

This isolated diagnostic investigates PR #250 at `7b69bf2b48d6177f5eb346021793ba79922be79e`. Its unchanged staged full-desktop report failed both the p95 gate (**66.6 ms**, limit 50 ms) and the zero-intervals-over-250-ms gate (**253.7 ms** and **250.1 ms**, at MacArthur Bridge). This collection is diagnostic only. A passing instrumented run cannot clear those failures, replace original acceptance, or approve a release.

The current report's phase aggregates do not isolate their cause. A frame interval is measured before the current callback, while its `renderMs` measures that callback's later work. The 10.4/11.7 ms render values on the two slow rows therefore describe subsequent work; subtracting them from the preceding intervals would misattribute the time. Trace events and CPU samples must be aligned to the same native input and browser clock.

## Exact application and build

| Input | Required identity |
| --- | --- |
| Actual application checkout | `7b69bf2b48d6177f5eb346021793ba79922be79e` |
| Source tree | `f8b443a9eb1bba9513a72f2f99e5088530abf544` |
| Original driver Git blob | `c722b5810a7693e5ece72ed00b4401e7cde7267a` |
| Build run | `45923547836` |
| Build artifact | `15165683648`, `belle-staged-architecture-verified-build` |
| ZIP bytes | `176935336` |
| ZIP SHA256 | `1fbb6f6e38cce8a93f59a65d900ab55a59809fd52433061d2795601885d38921` |
| Staged manifest Git blob | `6f6f4af0d3c8b88ae74a4f987da908bea8a1d208` |

Restore that immutable ZIP. If it expired or metadata/hash differs, fail; do not rebuild, change pins automatically, or substitute another artifact. Verify `staged-landmark-proof-build.json` names this checkout, its original index hash and `VITE_STAGED_BELLE_ARCHITECTURE=1`. The exact source manifest must still declare four models, three LODs each, and no production/native-performance acceptance. Hash every extracted GLB and require all twelve original byte lengths and SHA256 values, plus their asset-manifest entries. A default or partial build is not an acceptable substitute.

Execute the original `scripts/sustained-ride-profile.mjs` directly with a separate Node `--import` preload. No derived driver is generated. Application source, generated bundles, query `?profile=1&locationPerf=1`, full scene, native input, heartbeat, 90-second wait, launch flags, operation/case deadlines, High quality, cap 60, DPR 1, scale 1, 1440 × 900 viewport, reduced-motion selection, original GPS checks, original report and original process exit remain unchanged. Genuine `profile=1` auto-stop remains enabled. Changing it to `profile=manual` would alter the native stop boundary and is forbidden here.

Application and diagnostic code use separate checkouts. The original driver's `GITHUB_SHA` is the actual pinned application checkout, not the diagnostic commit or a fabricated identity. The previous failing report used synthetic merge `e6b3daab8d5159c97ec45d8913c9e58cc6031914`, whose tree equals this application tree; that distinction is retained. Every tracked diagnostic source and workflow byte is archived with its own head/tree, Git blob, SHA256 and length, then checked again after execution. The clean application checkout, original driver, complete compiled inventory and retained input ZIP are likewise verified before and after. Signed URLs and credentials are never archived.

## Minimal observations and lifecycle

No in-app loop/render probe, WebGL wrapper, GPU fence, RAF replacement or alternate renderer mode is enabled. Read-only native input listeners add three PerformanceMarks and retain timestamped RAF gaps, long tasks and supported long-animation-frame entries on the original game page. They do not dispatch input, replace game state, change clocks, or instrument rendering methods.

The original Locator factories remain synchronous and return their exact native objects. Browser tracing and the 1000-microsecond V8 CPU sampler are armed immediately before the original **Start 10-minute capture** click. That click executes once with its native receiver, arguments, result and errors. Setup failures remain diagnostic failures and do not substitute an action.

The release observer returns the exact original `keyboard.up('w')` promise. Once it fulfills, it immediately requests `Profiler.stop` and `Tracing.end`. No held-input delay or artificial work is added to produce a later CPU sample. Stop/snapshot, raw-stream flush and final report binding remain separate. The original GPS actions continue. Before the original game context closes, the observer joins stop and pending completion/flush only within the existing absolute deadline: native stop plus **60000 ms**. The original context-close operation is still invoked if observation fails. Browser closure retains its original result or error and joins remaining archival work.

Completion observation attaches before `Tracing.start` and remains attached through the original browser-close settlement. Every completion event records its host timestamp and whether it arrived before stop, on time or after the unchanged deadline. Early, duplicate, malformed and late events remain failures. Distinct streams are archived even if received late, but a recovered stream never erases a timeout. Raw data is drained in 1 MiB chunks and parsed/hash-checked incrementally; it is never converted into one enormous string. Independent read/write/file-close/CDP-close failures and partial files are retained.

This lifecycle comes from the hardened #247 collector at `318c763d9587392016dcfb0934c5daf948691230`. Its observer, preload, incremental JSON reader and final validator are unchanged here. That older native run still failed its own 60-second completion deadline; recovering its late trace did not make it complete. The present diagnostic must establish its own full-window evidence.

## What the evidence can distinguish

The raw Chrome trace includes renderer/browser/GPU process metadata, scheduler tasks, renderer timeline events, user timing, V8/GC and GPU/viz/cc categories. Categories are requested even when enumeration is empty; completeness depends on actual emitted events rather than advertised support. The renderer CPU profile retains function names, script IDs, source URL/line/column, node trees, samples and original signed time deltas.

Align the three native marks (`profile-start-click`, `first-w-keydown`, `w-keyup`) between browser and trace clocks. Then inspect the callback preceding each RAF gap and the matching CPU samples: application update stacks, renderer/Three submission stacks, GC or compilation, and scheduler waits are separate observations. Long tasks and long-animation-frame entries provide additional intervals and source locations where Chrome exposes them. Do not sum nested inclusive durations or subtract independent percentile aggregates.

GPU-process command scheduling or waits can support a bounded correlation; they do not measure GPU execution cost or certify GPU retirement. Current application mode `browser` intentionally owns no completion fence. Null fence counters therefore mean unknown completion in that mode, not unsupported hardware. This diagnostic neither adds a fence nor changes the queue capacity or scheduler.

The observer archives browser-consumed local JavaScript bodies under `capture/scripts/<SHA256>.js`, with URL, byte length and SHA256 matched against the immutable build inventory. This permits CPU call frames to be associated with the exact code that ran. Hidden source maps may be built separately from the same pinned source and dependencies, with original minification unchanged. Accept a map only after its associated generated JavaScript is byte-identical to the immutable artifact; never serve the rebuilt output or make this native run depend on map reconstruction. Until that association is verified, label stacks as minified and keep original generated positions. No source-map qualification is claimed by this bundle itself.

Tracing and CPU sampling add observer overhead. The evidence records their configuration, native boundary times, buffer observations, original report and host state. It does not invent a numeric overhead correction or treat a traced performance pass as uninstrumented acceptance.

## Completeness and original verdict

The trusted first-W-to-keyup interval must be at least **90000 ms**. Eligible active and excluded seconds remain separate original report values; no extra eligible-active-time predicate is added. Actual first/last CPU samples and positive-duration renderer timeline work must cover the native boundaries. CPU header bounds or process metadata alone do not qualify. Negative sample deltas, unsampled gaps and partial evidence remain unmodified. If the last actual CPU sample is early, coverage fails; do not extend the ride, delay stopping or interpolate samples to hide it.

The original process status is saved before the independent validator runs. Collector errors never set the original process exit code. The validator replays the exact original driver's gate expressions on a clone and checks the original report without rewriting it. It also independently verifies the original GPS artifacts. Original nonzero status takes precedence; if the original driver passes but the diagnostic is incomplete, this separate workflow still fails. Every diagnostic receipt says `diagnosticOnly: true` and `releaseAcceptance: false`.

## Scope and invocation

Only this directory and `.github/workflows/belle-desktop-stall-attribution.yml` belong to the proposal. The workflow has one macOS 15 desktop/full/High job (35-minute job and original 28-minute run step), with read-only contents/actions permissions. There is no build job, phone lane, changed scene, optional render-probe parameter or acceptance-suite rerun. Publish it with an isolated PR diff limited to these paths so unrelated application workflows are not triggered. Its YAML also declares `workflow_dispatch`; whether that trigger is callable depends on the available GitHub client, and no run is dispatched by this code.

For focused local tests, set `STRICT_DRIVER_PATH` to the exact original driver and `STRICT_STAGED_MANIFEST_PATH` to the exact pinned `public/belle/staged-architecture/manifest.json`, then run:

```sh
node --test observer.test.mjs sustained-trace-json.test.mjs source.test.mjs
```

Tests cover original gate and exit preservation; native locator/click/release semantics; arming before capture and stopping before GPS; real marker/timeline/sample coverage; signed deltas; late/partial stream and cleanup failures; incremental parsing/hashing; source/ZIP preservation; and rejection of stale source, default build, absent/altered staged proof, missing/corrupted GLBs or artifact pins. Native Chrome collection is intentionally left to the separate reviewed diagnostic workflow.

If these stacks are still insufficient, a later proposal may add an explicit opt-in `profile=1` observability switch. It must retain genuine auto-stop, archive its distinct instrumented source/build and declare its overhead. Existing submission probes omit uniform calls, VAO/attribute binding, extension multi-draw and a separate shared-buffer-validation bracket; residual direct-draw CPU cannot by itself identify those causes. That proposal is documented only and is not shipped or activated by this bundle.
