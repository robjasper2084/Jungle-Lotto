# Pinned reduced phone stall attribution

This separate diagnostic investigates the **270.6 ms and 266.9 ms** eligible intervals in the default reduced phone lane of PR #257. Its original p95 was **33.6 ms**, but the original zero-over-250-ms gate failed. Both slow rows are at the Jefferson Avenue / bridge approach, including one at the initial position. The original native W interval lasted **90,017 ms** with no application, request or probe errors. An independent browser observer recorded the same two long gaps and a 267 ms main-thread long task, without enough timestamps or stacks to identify their cause. This diagnostic cannot authorize a release or convert a failed acceptance run into a pass.

Collection arms before the original profile-start click, retaining the menu/focus prelude and early eligible intervals as well as the full native ride. It adds no warm-up, delayed start, additional input or excluded interval to avoid the observed early stalls.

## Immutable source and build

| Input | Required value |
| --- | --- |
| Application checkout | `32f25acf9a681b75ebf2018de2cac4234d8b4b2f` |
| Application tree | `e51f2b769627f237db893d229ef5c827e6923058` |
| Original strict driver blob | `c722b5810a7693e5ece72ed00b4401e7cde7267a` |
| Build run | `45952596632` |
| Build artifact | `15178554985`, `sustained-profile-game` |
| ZIP size | `176624823` bytes |
| ZIP SHA256 | `08e3277d7c4b46177e055a0a6ae9e364bf08e123f6c5d0b5931cfd622cae22fc` |
| Original failed job | `140368661779` |
| Original failed artifact | `15180522334`, `belle-sustained-profile-diagnostic-phone` |
| Failed-artifact ZIP SHA256 | `be547d4f5a83d4a108b264789d138b627ac13a610d80727c08fdf9be1af79917` |

The failed report names synthetic merge `df95e5720114edb0d74077f1f0a841896eb8fb71`, whose tree was independently verified equal to the pinned application tree. The diagnostic reports the actual pinned application checkout. It never fabricates a synthetic build marker. The original failed report and artifact remain authoritative and unchanged.

Restore the immutable default ZIP, require matching unexpired GitHub metadata, and hash the whole archive and every extracted file before and after execution. Reject symlinks, duplicate archive entries, unsafe paths, a staged-build marker, absent manifest assets, and unbound index scripts. Expiry or any mismatch is a failure; there is no rebuild or automatic substitute. Application and diagnostic use distinct clean checkouts. Every diagnostic source and workflow byte, commit, tree and Git blob is archived and verified again after execution.

## Original run stays authoritative

Execute `scripts/sustained-ride-profile.mjs` directly using Node's external `--import` observer. The driver is never copied into a derived implementation, rewritten, or patched. Its original environment selects `BELLE_PROFILE_DEVICE=phone`, `BELLE_PROFILE_MODE=diagnostic`, and `BELLE_PROFILE_SECONDS=90`.

The query remains exactly `?profile=1&perfProbe=1`, retaining trusted-keyup stopping. The original reduced scene is the case that failed; this diagnostic adds no scene reduction. Phone Smooth quality, cap 60, DPR/render scale 1, 390 × 844 viewport, genuine native input and heartbeat, native Metal launch flags, all frame-accounting expressions, p95 ≤50 ms, zero eligible intervals >250 ms, existing 28-minute step and 35-minute job remain unchanged. The reduced lane has no GPS subrun; its original `gpsRegression: null` must remain null. Full-scene GPS gates remain elsewhere unchanged.

The independent validator extracts and executes the exact baseline verdict expressions from the pinned original driver on a clone. It checks all five recorded verdict fields and never rewrites the raw report. Original nonzero exit takes precedence. If the driver passes but diagnostic collection is incomplete, the separate workflow still fails. Every receipt declares `diagnosticOnly: true` and `releaseAcceptance: false`.

## Smaller collection with preserved deadlines

The earlier broad #251 diagnostic preserved a 598,545,272-byte trace containing 3,403,597 events. Its original 60-second trace-completion deadline failed; the completion event arrived 14.433640 seconds late. That failure remains unchanged.

This phone diagnostic retains the collector independently verified in #254. Its earlier reduced desktop capture completed in 9.367 seconds and fully flushed in 12.215 seconds within the same 60-second deadline. That collection result is not a prediction of this phone run's duration or performance.

This collector keeps seven requested categories:

- `toplevel`
- `devtools.timeline`
- `disabled-by-default-devtools.timeline`
- `blink.user_timing`
- `v8`
- `disabled-by-default-v8.gc`
- `renderer.scheduler`

It omits the broad `gpu`, `viz`, `cc`, and `disabled-by-default-gpu.service` category requests. An offline category-union pass over the hash-verified old trace retained **941,348 of 3,403,597 events**, with **199,268,160 of 591,673,743 serialized event bytes**. These are measurements of a previous trace's subset, not predictions of current overhead, encoded trace size, or flush time.

The `toplevel` category still requests task boundaries across browser, renderer and GPU processes. Detailed GPU command-buffer wait names live in the omitted broad GPU category, so this narrower run cannot identify their precise duration. It can distinguish sampled application work, renderer callback time, GC and coarse native scheduling. No event is discarded after capture: the full trace actually emitted under the declared category selection is retained and independently hashed.

The original 1,000-microsecond CPU sampling interval, 256 MiB trace buffer, record-until-full behavior, and 60,000 ms absolute completion deadline remain unchanged. Native marks and observers arm immediately before the original capture click and stop on completion of the exact original trusted W-keyup promise. No delay is inserted to manufacture sample coverage.

Completion is observed from before tracing starts until native browser-close settlement. Early, duplicate, malformed or late completion events remain explicit failures. Late data is retained without erasing the timeout. Trace chunks are drained in 1 MiB pieces and parsed incrementally. Read/write/close failures and partial bytes are retained. The reduced driver closes the browser directly after writing its report; this path and the optional explicit-context-close path are both covered by focused tests.

## Attribution and limits

Read-only page listeners record the profile-start click, first trusted W-keydown and trusted W-keyup as PerformanceMarks. They retain timestamped independent RAF gaps, long tasks and supported long-animation-frame entries. No input is dispatched, game state is written, animation loop is replaced, GL method is wrapped, fence is added, or clock is changed.

Map the three page marks to matching trace events. Require a consistent renderer process/thread and clock offset. Actual CPU samples and positive-duration renderer timeline work must span the native ride boundaries. Header timestamps or process metadata alone do not establish coverage. Keep negative CPU deltas and unsampled gaps unchanged.

For each timestamped RAF gap, inspect overlapping preceding application callbacks and signed-delta CPU samples on that same clock. Retain function/script/line/column identities and separate nested inclusive events from self samples. The original eligible slow-frame rows do not contain timestamps: matching a duration is only a candidate association and cannot become an exact eligible-row join. A slow row's current `renderMs` describes later callback work and cannot explain the preceding frame gap.

Archive and hash the actual JavaScript response bodies consumed by the browser. Use source maps only if their generated code is byte-identical to those bodies; until then keep generated code locations. Sampling/tracing adds overhead. No numeric overhead correction, GPU-execution claim, causal application defect, or completed runtime repair is inferred from collection success.

## Tests and scope

Run these focused checks with the exact pinned driver:

```sh
STRICT_DRIVER_PATH=/path/to/scripts/sustained-ride-profile.mjs node --test observer.test.mjs sustained-trace-json.test.mjs source.test.mjs
```

The tests preserve native promises/receivers/errors, exact original verdicts and exits, trusted stopping, unchanged timeout failures, late-data archival, both browser-close lifecycles, real renderer/sample coverage, signed deltas, incremental raw hashing, immutable artifact/source binding, and exact seven-category selection.

Only `.github/diagnostics/belle-reduced-phone-stall/` and `.github/workflows/belle-reduced-phone-stall-attribution.yml` belong to this proposal. It leaves #251, #254 and #257 unchanged and contains no game, navigation, scenery, collision, or original acceptance-workflow changes. A later runtime repair must follow causal evidence and then pass the unmodified, uninstrumented gates on its final integrated revision.
