# Native compositor and GPU-service attribution

This standalone diagnostic observes original PR 210 only. It adds Chrome compositor,
frame-delivery, task-flow and GPU-service CPU evidence absent from the retained
renderer CPU trace. It makes no product change, does not measure hardware GPU
execution, and never grants release acceptance.

| Fixed input | Value |
| --- | --- |
| Source commit | 75906273c0cd414c0d004320fc6f654b4783e5b1 |
| Source tree | 9f0351be133dd370a676090d27559a0adaf00605 |
| Driver blob | c722b5810a7693e5ece72ed00b4401e7cde7267a |
| Driver SHA-256 | 8f6af949083800c491b65e0709c04cc29eb5712634f744c5b912f76ce651fcf5 |
| Audited observer ancestor | ac88da2e62f46a50020391e8629ac0dbd995baea |
| Observer ancestor tree | 6ff52ffbf2c1eed6aef8557e542be7eb6fbb7754 |
| Runtime | Original locks; Node 24; Playwright 1.61.1; native macOS Chrome |
| Original workload | Full/default desktop, 1440 × 900, DPR 1, High, cap 60, genuine 90-second W hold |

The driver runs in place, byte for byte. Original thresholds, eligibility,
keyboard/heartbeat, W-up, metrics, report, GPS checks and deadlines are retained.
No game, graphics, pose, input, visibility, render scheduling or bundle is replaced.
Source/driver/lock receipts, build hashes, actual Chrome version, launch arguments
and loaded JavaScript response hashes are preserved.

The payload occupies only `.github/probes/native-compositor/` and its own workflow.
This parser revision overlays exactly four existing files on observer commit
cff46940b20bd27fadbae1bc8039e4a2050a4e4f: trace-parser.mjs, manifest.json,
README.md and contract.test.mjs. The only runtime change is the parser; all seven
other payload files, including preload/indexing/ownership code and the workflow,
remain byte-identical. Existing CPU-diagnostic files remain unchanged. Publish
only that reviewed overlay, never an entire local tree. There is one fixed job,
no selectable source ref, matrix or retry. Attempts greater than one are skipped.
Preparing this payload does not authorize a run.

## Category evidence and limits

The exact required category list is:

```
cc,viz,gpu,toplevel,toplevel.flow,devtools.timeline,blink.user_timing
```

All seven existed in the retained original-210 enumeration receipt. That is
discovery evidence, not proof of raw event coverage: the reference CPU trace did
not request cc, viz, gpu, toplevel or toplevel.flow. The reference browser was
Chrome 158.0.8127.89, revision 1de57fa19722fa6d6841d4f596c394d015580656.
Each actual browser version is recorded again.

The exact Chrome source turns the controller's returned category set directly
into a successful protocol array; the discovery path does not expose service
query/parse success. An empty array therefore does not establish that explicit
tracing is unsupported. Tracing.start independently configures and enables the
backend and enforces its permission/protocol errors.

The full enumeration response and category value are retained exactly. A valid
empty or incomplete string array produces an explicit warning. The observer then
requests the same seven categories exactly once, with no discovery retry, extra
protocol call or category substitution. Malformed enumeration, enumeration
protocol errors and actual Tracing.start failures still fail the diagnostic.
Completeness requires a raw event from every required category inside the trusted
W window, independently of enumeration. Startup/shutdown events cannot satisfy
that requirement. Instant toplevel.flow events are valid; legacy s/t/f phases are
not required for category coverage.

| Evidence | Interpretation |
| --- | --- |
| cc BeginFrame/deadline and PipelineReporter | Frame scheduling, main-thread handoff, commit/activation and delivery-stage latency |
| viz draw, swap, acknowledgement and feedback | Display-pipeline progress and frame IDs; acknowledgement differs from presentation |
| gpu schedule/unblock/run/finish and flush flows | CPU service and dependency/scheduling milestones in the GPU process |
| toplevel and toplevel.flow | CPU task wall intervals and post-to-run links; spans can include waiting/descheduling |
| devtools.timeline and blink.user_timing | Main callback context and the unchanged trusted W/rAF clock anchors |

CommandBuffer::FlushComplete means the service consumed commands, not that the GPU
finished them. GPU-process CPU wall spans are not hardware GPU duration. Feedback
can be estimated or missing. The retained Metal device was Apple Paravirtual;
virtual display timing is not physical scan-out certification. Uncovered time
remains unknown.

Tracing and IO now use one owned browser CDP session. This is an explicit scope
change: browser-root tracing has no page target PID filter and can include all
browser processes. The former trusted page trace included the target, browser and
existing GPU-process IDs, but its transport could be destroyed when the unchanged
GPS check released the original page/context. The original renderer remains bound
to the unchanged trusted W marks. Actual cross-process coverage is required: all
seven raw categories inside the trusted W window, named browser
tasks, GPU-service and Viz tracks outside the renderer,
main rAF callbacks, PipelineReporter events, separate GPU/Viz flow records and
trusted-window marks. Renderer-only flow events cannot satisfy GPU/Viz coverage.
Missing process or thread records can still leave coverage incomplete. Category
availability or browser-session ownership alone never certifies these tracks.

The raw trace is saved unchanged with its SHA-256. PID/TID, id/id2/bind_id, flow
flags, phases, timestamps, arguments and source-frame IDs are not normalized.
trace-process-threads.json indexes raw process/thread metadata and coverage counts.
It does not rewrite flow identifiers, which can exceed JavaScript's safe integer
range. Metadata or track-index overflow makes the diagnostic partial.

## Unchanged input and metrics boundary

hooks.mjs and page-probe.mjs are byte-identical to ac88, checked by source-only
contracts. The existing belle-native-cpu: mark prefix/private observer name is
retained to avoid changing the input/rAF contract. Payload identity and environment
variables distinguish this compositor diagnostic.

The initial WebGL probe and later GPS pages are not instrumented. Observer setup
precedes the original first Performance.getMetrics. The second metrics call
returns its original result without awaiting profiler stop, drain, indexing,
writes or snapshots. W-up remains the original trusted event.

The 2 ms CPU observer is retained for the audited profile/alignment contract and
native task context. This is sampled evidence, never performance acceptance.
No precise coverage, heap snapshot, forced GC, screenshot trace or broad disabled
by default debug category is added. V8-specific tracing is no longer requested;
complete GC trace coverage is not claimed. Resource/script receipts stay bounded.

## Owned transport lifecycle

One independent page CDP session owns Profiler and Debugger; one independent
browser CDP session owns Tracing and IO. The original driver's CDP session remains
untouched. Both Profiler.stop and Tracing.end start before waiting for the final
page checkpoint, bundle work or metadata persistence. After the CPU result, final
page checkpoint and bounded pending bundle work settle, the observer detaches its
page session promptly. It does not wait for the potentially longer browser trace
flush. The original page/context can close while browser tracing continues.

This repairs a source-supported lifetime mismatch, not a demonstrated performance
cause. The earlier page-owned attempt exhausted its 60-second budget and then
reported a closed target. Its retained timestamps bracket source-context release
across that deadline; they do not establish the exact closure instant or prove
that closure was the only reason the flush notification was absent. Neither the
original GPS sequence nor page/context closure is delayed by this repair.

Each owned session is created once with the existing 4-second bound. Each detach
has the existing 2-second acknowledgement-and-close bound. Completeness requires
both a successful explicit detach acknowledgement and the session's close event,
with exactly one owned detach call for each session. A close event alone is not an
acknowledgement. Unexpected closure, late creation, failed or late detach, and
missing required CPU or trace data permanently invalidate completeness. A session
created after cancellation or expiry is detached without being used. CPU and raw
trace files are saved independently when available.

Page close, context close, browser disconnect, owned session creation/close and
detach request/acknowledgement receive Node epoch timestamps in the status/events.
These listeners remain active during finalization and do not add awaits to the
driver. Browser-close cleanup retains its total 10-second bound. On expiry it
marks the diagnostic partial before initiating both remaining detach attempts,
without extending the original browser-close wait. Late EOF, writes, close events
or acknowledgements cannot recover completeness.

## Explicit bounds and sizing allowance

The watchdog is 110 seconds around the original 90-second workload. Both recorder
stop commands are issued independently of the serial metadata-write queue. A
blocked stopping-event write cannot keep recording. Protocol calls retain a
4-second timeout. The recordUntilFull buffer is 512 MiB; the raw saved trace has
an independent 1 GiB cap (1,073,741,824 bytes). Only the file cap changes;
the recording buffer remains 512 MiB.

The manifest retains the initial 128 MiB assumption as superseded history. That
assumption scaled a 27,956,883-byte renderer CPU trace and allowed 60 additional
records per 60 Hz frame; subsequent evidence shows that allowance was insufficient.

A read-only, hash-verified peer trace from PR 265 contains 242,232,971 raw bytes and
1,142,915 events. Inside its raw-confirmed 90.024217-second W window, just our three
shared categories (toplevel, devtools.timeline and blink.user_timing) contribute
623,947 events and approximately 148,551,288 reserialized bytes. This shared union
already exceeds the former 134,217,728-byte cap, before the newly requested cc,
viz, gpu and toplevel.flow traffic. Exact raw bytes/hash and estimated reserialized
event totals are distinguished in the manifest. The peer uses a different build
and additional categories, so this is capacity evidence, not a performance
comparison or an exact forecast. Complete volume for the four new categories
remains unmeasured;
the previous 512 MiB file allowance was finite and has now been exhausted by
the original seven-category capture described below.

The peer's full flush took 16.561 seconds for 242,232,971 bytes. Linear scaling to
the then-512-MiB cap is about 36.7 seconds; that evidence originally informed a 60-second
finalization allowance. The first browser-owned capture then demonstrated a
different constraint. In [capture run 45987971947](https://github.com/robjasper2084/Jungle-Lotto/actions/runs/45987971947),
Tracing.end was acknowledged after 3 ms,
but the completion notification arrived 58.009 seconds after stop issuance.
Draining began after 58.012 seconds, leaving 1.988 seconds of the existing budget.
The final read exhausted its remaining 4 ms allowance. Independent
[archive audit 45992949088](https://github.com/robjasper2084/Jungle-Lotto/actions/runs/45992949088)
confirmed a truncated 90,177,536-byte prefix with SHA-256
6cee8382cf4fbd6b2e24071063d6902c9ae30554a10592c1673aff9849a9a675.
The buffer high-water mark was 22.0138%; cap and loss flags were false. Both owned
sessions acknowledged detach and closed cleanly. The original page/context had
closed about 12.7/12.8 seconds after stop, before the browser trace notification,
so the ownership repair is retained. This evidence establishes collection-budget
exhaustion; it does not attribute the game's long frames.

One 120-second trace finalization budget now starts when Tracing.end is issued
and covers its acknowledgement, the asynchronous
Tracing.tracingComplete notification, completion receipt, stream reads, indexing
and trailing trace persistence. That notification is a flush event, not an RPC
response. Every individual RPC, including Tracing.end and IO.read, still has its
4-second timeout. The absolute stop-issuance deadline is passed into collection;
stream arrival never grants a second 120-second allowance. The larger finite
allowance applies only to post-stop collection; the 90-second workload, 110-second
recording watchdog and original source/input/performance gates are unchanged.
The new post-stop reader limits are listed below; pre-existing resource, protocol
and cleanup bounds remain unchanged. Future native collection and indexing cost remain unproved, so
the allowance does not guarantee success. Receipts retain stop
issuance, acknowledgement, notification, deadline and finalization timestamps.
Missing or late notifications and late persistence remain partial, and late
continuations cannot restore completeness. Each bounded event is parsed
synchronously, with checks before and after its visitor; a JavaScript timer
cannot preempt a single record parse. No whole-file Buffer or JavaScript string
is materialized. Indexing cost is diagnostic overhead. Browser-close
cleanup retains its total 10-second bound, including trailing writes, and the
original driver step remains capped at 28 minutes. If close arrives before the
diagnostic finishes, it records partial status instead of extending cleanup.
Any buffer/file overflow or late completion still makes the diagnostic partial.

Topology permits 4,096 metadata rows and 4,096 tracks. Existing bounds remain:
16,384 raw rAF pairs; 4,096 long tasks; 256 marks; 32 MiB/128 loaded scripts;
8,192 asset-event records; 4,096 parsed scripts; an 8 MiB script cache; 30-second
observer checkpoints. The complete job remains bounded at 50 minutes.

Buffer loss/fullness, truncation, missing cross-process evidence, alignment failure,
overflow, incomplete samples, transport/I/O failure or deadline expiry makes the
diagnostic partial. Late failures always invalidate completeness. The runner
requires matching clean invocation/status/terminal receipts; an earlier stale
success cannot override a late failure. CPU saving remains independent of trace
failure. The original failed verdict remains failed and visible.

## Streaming index and file-cap evidence

[Run 45995465789](https://github.com/robjasper2084/Jungle-Lotto/actions/runs/45995465789)
retained exactly 536,870,912 bytes and set capReached=true with dataLoss=false.
The independent audit fully hashed that retained prefix as
4ab5b9443d28a1d58b8c217042191a9bba17227d2a5bba6c3dec0eba4bdf637d,
parsed 3,192,611 events, and rejected its truncated JSON document. Both trusted-W
marks occur in the incomplete prefix; that does not certify a complete window.
Finalization finished 77.264 seconds after stop, within its 120-second budget;
both owned sessions closed cleanly. The original verdict remained failed.
This is evidence for a larger finite file allowance, not evidence that 1 GiB
will contain the complete trace. No buffer, source, driver, workload or category
change follows from it.

trace-index.mjs performs two incremental scans after raw EOF. The first retains
bounded original metadata and projected observer marks. The second evaluates the
same inclusive trusted-W-window coverage predicates, with all auxiliary maps
restricted to tracks admitted by the single 4,096-track registry. Metadata and
marks may be in nonchronological order. Both complete JSON receipts must agree on
raw SHA-256, bytes and event count, and the byte count must match actual written
bytes, before marks/topology/index completeness is published. Raw flow identifiers
remain in the raw file and are never normalized or used for numeric-ID joins.

The grammar/UTF-8 scanner is a narrow fork of source blob
7cd2800adbcd140f1f476eb26543cc30cb6913d2 at PR265 commit
b8fd4ccc564f231ff7f9b605379f417b6bd1d4bc, path
.github/diagnostics/belle-full-desktop-stall/sustained-trace-json.mjs.
The recorder fork adds root-key count/size guards. This revision also replaces
the redundant JavaScript scalar lexer inside an already-admitted event with a
bounded structural boundary scanner. It tracks matching brackets and string
escapes, including escapes split across chunks, and retains the same total
nesting and original UTF-16 record-character bounds. The same JSON.parse call
validates each complete bounded event before incrementing its event count or
calling the synchronous visitor. Native JSON duplicate-key, negative-zero,
number and surrogate behavior is preserved. Error wording or the point within a
malformed event at which rejection occurs can differ; invalid events cannot be
delivered. Root/ignored-metadata grammar, UTF-8, duplicate root traceEvents,
full-file hashing, hash-only failure drain and cancellation are unchanged.

The parser is not byte-identical to its source ancestor. Its current SHA-256 is
fba506d1925b0fd83bfa05750a6290cf5c122b96dcf6c22b76c4458e4ebd57fe;
source and fork hashes remain in manifest.trace.streamingIndex.parserSource.

Additional reader/index limits are explicit:

| Retained item | Bound |
| --- | ---: |
| Filesystem chunk | 65,536 bytes |
| Individual event record | 33,554,432 JavaScript characters |
| Parser nesting | 4,096 levels |
| Root keys | 64, each at most 4,096 characters |
| Metadata | 4,096 rows and 8 MiB of serialized retained rows |
| Observer marks | 256 and 1 MiB of serialized retained marks |
| Category names | 256 distinct; combined per-event text at most 4,096 characters |
| Phase values | 64 distinct; each at most 64 characters |
| PID/TID registry keys | 4,096 characters each; 4,096 distinct tracks |

Guards reject before retaining an overflowing value. Count/byte/index overflow
is recorded separately from the browser's data-loss flag and permanently leaves
the diagnostic partial. The finite record limit bounds synchronous parsing but
is not a promise of a particular peak RSS for arbitrary record shapes.

One abort scope owns the absolute stop-issued deadline and active filesystem
streams. Deadline expiry, bounded-cleanup expiry, unexpected browser-trace
transport closure and outer trace-task errors actively destroy those streams.
The source iterable checks before/after reads, including after the parser has
switched to hash-only draining following an earlier syntax/visitor error. A
Promise.race rejection by itself is not treated as cancellation. Successful
finalization requires no background reader. Late open results are closed once;
late reads or index writes cannot restore completeness after failure. Raw bytes
and an independently saved CPU profile survive every indexing failure.

Source-only validation preserves all 41 previous contracts and adds semantic
parity against five frozen baseline output receipts, parser/retention negatives,
changed two-pass receipts, stalled-read/hash-only-drain cancellation, filesystem
creation races, cleanup and unexpected-transport cancellation, and late-index
persistence checks. A generated 536,876,467-byte valid document exceeded this
Node24 runtime's 536,870,888-character MAX_STRING_LENGTH and validated twice with
no giant string or raw file. Its child used a 64 MiB old-space and 4 MiB semi-space
limit; the retained first execution reported 53,676 KiB max RSS and a 79,691,776-byte
heap limit. That synthetic document has 15 events and a large ignored scalar tail:
it proves the whole-string limit is avoided, not millions-of-events throughput,
representative native memory use, or success within the native 120-second budget.

## Observed index deadline and scoped processing improvement

[Run 46002058074, attempt 1](https://github.com/robjasper2084/Jungle-Lotto/actions/runs/46002058074)
on cff46940b20bd27fadbae1bc8039e4a2050a4e4f retained the complete
665,443,680-byte native-trace.json in artifact 15201045235. The independent
two-pass raw inventory validated 4,005,489 events, an object root with exactly
traceEvents and metadata keys, and SHA-256
1b13ff539ccfd1f88099538fab6171598c69612b94d37d08fafc450435778da1.
There was no file-cap hit or reported trace loss. Both owned sessions closed
cleanly and the CPU profile was retained.

That producer still failed. Its stop ACK arrived at +10 ms, trace completion
notification at +63,900 ms, and drain began at +63,908 ms. The unchanged absolute
120-second budget therefore left 56,092 ms for draining, both indexes and
persistence. The first index pass expired with a null pass receipt; the second
pass never started. The capture-collected receipt arrived at +120,007 ms. No
distinct drain-finish/index-start timestamps were retained, so the native first
pass's duration cannot be inferred. Complete raw bytes do not replace missing
producer index, alignment and finalization receipts. That diagnostic remains
partial and is not accepted for timing attribution.

The parser change was measured once against the exact retained member using
fresh Node v24.22.3 children on Linux, baseline first then candidate. Both used
the unchanged full topology accumulator, two fresh bounded ZIP streams, identical
256-MiB old-space/16-MiB semi-space limits and a fixed 120-second index scope.
All four complete raw passes matched the exact bytes, SHA, event count, root and
EOF. Aggregate receipts, topology, marks and retained bounds matched exactly.
All four decompressors returned successful CRC/EOF receipts and exited cleanly.

| Offline measure | Published parser | Event scanner |
| --- | ---: | ---: |
| Complete two-pass index | 54,534.004 ms | 32,282.774 ms |
| First-pass completion | 20,405.497 ms | 14,221.532 ms |
| Node user CPU | 54.074506 s | 31.968736 s |
| Node self max RSS | 87,808 KiB | 101,672 KiB |
| Parent wait4 max RSS | 87,808 KiB | 102,752 KiB |

Elapsed indexing time decreased 40.8025% in this single comparison, corresponding
to 1.68926 times the processing throughput. The higher candidate memory readings
are retained. ZIP decompression and both stream startups were included; source
and archive preflight plus final report writing were excluded. Archive prehashing
warmed the filesystem cache before both lanes. Fixed order, JIT startup,
decompression and shared-host activity remain confounders. There were no retries,
warmup scans or replacement samples. The exact archive, source, harness and
result-report hashes are retained in
manifest.trace.streamingIndex.offlineEventParserComparison.

This is offline processing evidence. Native macOS notification/drain/persistence
duration and future completion within 120 seconds remain unproved. It does not
explain a game stall, measure hardware GPU duration or establish release readiness.
All categories, buffer/file/retention caps, deadlines, original source and driver,
input, ownership, CPU saving and completeness gates remain unchanged.

All 57 existing collector contracts passed against the exact approved parser.
The new production contracts preserve their original bytes and add focused event
boundary, byte-split escape, native JSON, record/depth, mutation, truncation,
visitor-failure and parser-provenance checks. The separate frozen differential
suite has 22 passing contracts; the offline harness has 17 passing small contracts.

## Artifacts and source-only validation

- original-driver-output/report.json and original-driver-exit.json retain the
  unchanged verdict, input/profile and GPS checks.
- native-trace.json or native-trace.partial.json retains raw trace bytes.
- trace-process-threads.json retains raw process/thread metadata, PID/TID inventory,
  flow counts and coverage requirements.
- trace-index-receipt.json records two complete matching raw receipts and retained
  index counts/bytes; diagnostic-status.json retains failed pass receipts as available.
- trace-categories-response.json and trace-categories.json retain the discovery
  response/value; trace-category-request.json retains the exact requested list,
  missing-enumeration warning and distinct actual-data requirement.
- trace-completion.json and trace-observer-marks.json retain the loss/stream receipt
  and trusted clock anchors. trace-process-threads.json independently counts each
  required category only within the trusted W window.
- native.cpuprofile retains raw nodes, samples and signed deltas.
- source-*.json, built-files.json, payload-manifest.json, invocation.json,
  loaded-bundles.json and bundles/*.js bind source to executed bytes.
- observer-*.json, asset-events.ndjson and parsed-scripts.ndjson retain bounded
  browser/resource evidence.
- diagnostic-status.json, diagnostic-events.ndjson, result.json,
  observer-process-exit.json and optional observer-cleanup-terminal.json retain
  partial/terminal health separately from original acceptance.

Node syntax checks, contract.test.mjs and run.mjs inspect use no browser. Contracts
retain the c722 lifecycle and negative finalization/blocked-write cases, then check
fixed scope, malformed/protocol discovery failure, advisory receipts, one unchanged
category request, actual window coverage, raw IDs, missing names/flows and overflow.
Ownership fixtures close the original page while browser flush is pending and
require a valid retained trace; negative cases cover early page closure, missing
CPU data, unexpected browser-session closure, late creation/detach and bounded
cleanup expiry. Both explicit detach acknowledgements and close events are
required by terminal validation.

Exact-revision Chromium sources used for semantic checks (all under
https://github.com/chromium/chromium/blob/1de57fa19722fa6d6841d4f596c394d015580656/):

- gpu/command_buffer/service/scheduler.cc
- gpu/ipc/service/command_buffer_stub.cc
- cc/metrics/compositor_frame_reporter.cc
- components/viz/service/display/display.cc
- base/task/common/task_annotator.cc
- content/browser/devtools/protocol/tracing_handler.cc
- content/browser/devtools/render_frame_devtools_agent_host.cc
- content/browser/devtools/browser_devtools_agent_host.cc
- content/browser/devtools/devtools_session.cc
- docs/life_of_a_frame.md

Official protocol references:

- https://chromedevtools.github.io/devtools-protocol/tot/Tracing/
- https://chromedevtools.github.io/devtools-protocol/tot/Profiler/
- https://chromedevtools.github.io/devtools-protocol/tot/IO/
- https://chromedevtools.github.io/devtools-protocol/tot/Target/
- https://playwright.dev/docs/api/class-cdpsession#cdp-session-event-close

The pinned Playwright 1.61.1 implementation uses Target.attachToBrowserTarget for
browser.newBrowserCDPSession. Its CDPSession close event is emitted for the exact
detached session, including explicit session.detach(); browser disconnection is a
separate event. The corresponding source checks use
https://github.com/microsoft/playwright/tree/v1.61.1/packages/playwright-core/src/
(client/cdpSession.ts, server/chromium/crBrowser.ts and
server/chromium/crConnection.ts).
