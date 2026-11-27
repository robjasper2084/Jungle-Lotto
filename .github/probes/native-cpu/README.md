# Native CPU and GC attribution

This payload records diagnostic evidence on the two immutable original candidates.
It does not repair product code, replace release acceptance, or approve deployment.

| Fixed case | Source commit | Source tree |
| --- | --- | --- |
| Original PR 210, default desktop | 75906273c0cd414c0d004320fc6f654b4783e5b1 | 9f0351be133dd370a676090d27559a0adaf00605 |
| Original PR 215, default desktop | 1e4feafa6964f4c68b27bae07e02d102f92a2c5d | 58e2e20338be0ca9cac3a8058b836eaf9d990a1f |

Both cases retain driver blob c722b5810a7693e5ece72ed00b4401e7cde7267a,
SHA-256 8f6af949083800c491b65e0709c04cc29eb5712634f744c5b912f76ce651fcf5.
The source file is executed in place, byte for byte. There is no transformed copy.
Original package and lock hashes, exact source trees, build output hashes, loaded
JavaScript response hashes and matching built-file hashes are saved with the data.
The original locked Playwright version is 1.61.1; Node major 24 matches the original
default native workflow. Native Chrome version and launch options are recorded.

## Observation boundary

A Node preload loads the same locked Playwright module as the source driver. It
wraps the driver's launch/newPage methods without changing their arguments or
results. The initial WebGL probe page and later GPS pages are left alone.
The first real 1440 by 900 game page receives an independent observer. Its own
preallocated arrays store raw rAF timestamp/entry-time pairs and long-task
start/duration pairs. Trusted profile-click and W events create browser user-timing
marks. No game functions, input, pose, DOM state, graphics, render scheduling,
measurement eligibility, or original observer queues are changed.

Read-only Playwright request events retain asset URL, request type, completion or
failure, and original resource timings. Parsed-script metadata from the separate
CDP session retains script ID, URL, content hash and source locations. Enabling
that protocol domain replays existing scripts, so receipt time is explicitly not
called parse time. No breakpoints or pause commands are installed. The raw trace
and continuous CPU samples cover asynchronous work outside game callbacks.

Before the first original CDP Performance.getMetrics call, a separate CDP session
starts 2 ms CPU sampling and the bounded GC/main-thread trace. Observer setup is
therefore outside the original initial-counter/wall-time boundary, in its prelude.
The second original metrics
result initiates asynchronous stop. It never awaits CPU stop, trace draining,
disk writes, or observer snapshots before returning the original result.
The original keyboard/heartbeat/90-second hold, trusted-keyup finish, report,
thresholds and GPS checks execute unchanged.

The original report and exit code remain visible. An original failure still
fails this job. A partial diagnostic also fails the diagnostic job, while keeping
the original verdict separate. Instrumentation and periodic snapshot overhead
are present, so an observed pass is never release approval.

## Bounds and failure evidence

There are two explicit native macOS jobs, no matrix expansion, no selectable refs
and no retries. Rerun attempts greater than one are skipped. The original capture
step deadline remains 28 minutes; each complete build/capture job is capped at
50 minutes.

The independent recording watchdog is 110 seconds. A 32 MiB record-until-full
trace buffer and 64 MiB saved-stream cap have explicit loss/cap receipts. The raw
observer retains at most 16,384 rAF samples, 4,096 long tasks and 256 marks, with
overflow counts. Loaded script storage is capped at 32 MiB and 128 scripts.
Asset-event records are capped at 8,192 and parsed-script records at 4,096.
The protocol's unreferenced script cache is bounded to 8 MiB.
Observer cleanup is bounded at 10 seconds and never extends the workflow deadline.
That bound includes trailing persistence. A timeout writes a small synchronous
partial receipt and does not wait on the blocked serial queue again.

Status, phase events, loaded bundles and 30-second observer checkpoints are
saved incrementally. The original driver stdout/stderr are streamed to disk.
CPU profiles are saved independently of trace and clock-alignment success.
A browser/process crash can prevent the browser from returning an in-memory CPU
profile or trace; such absence is explicit, and earlier receipts/checkpoints are
retained. Signal handling writes only a small interruption receipt and immediately
redelivers the signal.

Completeness is promoted only after transport detach, queued writes and the final
status write succeed. Every later failure or overflow clears completeness and
increments a sticky failure revision. The runner requires clean persisted status
and a clean final process receipt with the same unique invocation ID. It rejects
contradictory complete/partial flags, recorded errors, transport or I/O failure,
and stale/missing receipts even if an earlier clean status file remains on disk.

Trace loss, any reached cap, observer errors, missing trusted marks, incompatible
clock correspondence, incomplete profile arrays, or unavailable evidence result
in partial-diagnostic status. No artificial clock offset is supplied when marks
cannot be aligned. Raw CPU data remains available for stack analysis.

The original build regenerates one tracked elapsed-time statistic. The source
guard permits only its buildMs value to differ and saves the exact before/after
receipt and diff. Any other tracked change is rejected; no file is restored or
rewritten by this payload. Default build flags must be absent.

## Artifacts

- source-*.json, payload-manifest.json, invocation.json and built-files.json:
  source, driver, dependency, runtime and build provenance.
- original-driver-output/report.json and original-driver-exit.json:
  unchanged original report, screenshots and process result.
- native.cpuprofile: raw profile nodes, samples and microsecond time deltas.
- native-trace.json or native-trace.partial.json: raw GC/main-thread trace.
- trace-completion.json, trace-categories.json and trace-observer-marks.json:
  actual protocol coverage, buffer loss and clock markers.
- observer-*.json: raw rAF and long-task checkpoints with explicit overflow.
- bundles/*.js and loaded-bundles.json: exact loaded script source and SHA-256.
- asset-events.ndjson and parsed-scripts.ndjson: resource completion timings,
  script locations and replay-aware metadata for deferred-work investigation.
- diagnostic-status.json, diagnostic-events.ndjson and result.json:
  diagnostic completeness and original acceptance result kept distinct.
- observer-process-exit.json and optional observer-cleanup-terminal.json:
  final invocation-bound health and synchronous timeout/failure receipts.

## Local validation only

Run Node syntax checks and contract.test.mjs without launching Chrome. The hook
tests exercise the original c722 creation sequence, ignore the probe/GPS pages,
preserve argument/result identity, verify that a pending observer stop cannot
delay ending metrics, and exercise trusted-input boundaries and overflow.
Negative finalization cases cover detach failure, final-write failure, late
asset/metadata failure, stale or contradictory status, and blocked final cleanup.
The run.mjs inspect action checks immutable Git objects and lock/driver hashes
without using or changing another checkout's working files.

Official protocol/API references used for this implementation:

- https://chromedevtools.github.io/devtools-protocol/tot/Profiler/
- https://chromedevtools.github.io/devtools-protocol/tot/Tracing/
- https://chromedevtools.github.io/devtools-protocol/tot/IO/
- https://chromedevtools.github.io/devtools-protocol/tot/Debugger/
- https://playwright.dev/docs/api/class-browsercontext#browser-context-new-cdp-session
- https://playwright.dev/docs/api/class-page#page-add-init-script
- https://playwright.dev/docs/api/class-response#response-body
- https://playwright.dev/docs/api/class-request#request-timing

Precise coverage, heap snapshots, forced GC, screenshot tracing, source maps
that change the executed bundles, and game-state controls are not enabled.
