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

The new payload occupies only `.github/probes/native-compositor/` and its own
workflow. Existing CPU-diagnostic files remain unchanged. A future publisher must
publish only these nine new paths onto its approved base, or use ac88 as the PR
base. A PR containing the inherited CPU workflow against main would also select
that older pair and is outside this scope. There is one fixed job, no selectable
source ref, matrix or retry. Attempts greater than one are skipped. Preparing this
payload does not authorize a run.

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

Exact Chrome source adds browser and existing GPU-process IDs to a trusted page
trace, so the audited page CDP hook is retained. Actual cross-process coverage is
required: all seven raw categories inside the trusted W window, named browser
tasks, GPU-service and Viz tracks outside the renderer,
main rAF callbacks, PipelineReporter events, separate GPU/Viz flow records and
trusted-window marks. Renderer-only flow events cannot satisfy GPU/Viz coverage.
GPU restart can still leave
coverage incomplete. Category availability alone never certifies these tracks.

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

## Explicit bounds and sizing allowance

The watchdog is 110 seconds around the original 90-second workload. Both recorder
stop commands are issued independently of the serial metadata-write queue. A
blocked stopping-event write cannot keep recording. Protocol calls retain a
4-second timeout. The recordUntilFull buffer is 512 MiB; the raw saved trace has
an independent 512 MiB cap (536,870,912 bytes).

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
comparison or an exact forecast. The four new categories remain unmeasured;
512 MiB is a finite allowance, not a promise that every capture fits.

The peer's full flush took 16.561 seconds for 242,232,971 bytes. Linear scaling to
the new cap is about 36.7 seconds. A 60-second asynchronous trace drain/indexing
budget provides bounded headroom, including trailing async
persistence. Parsing is synchronous and bounded by file size; a JavaScript timer
cannot preempt its CPU work. Its wall cost is diagnostic overhead. Browser-close
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

## Artifacts and source-only validation

- original-driver-output/report.json and original-driver-exit.json retain the
  unchanged verdict, input/profile and GPS checks.
- native-trace.json or native-trace.partial.json retains raw trace bytes.
- trace-process-threads.json retains raw process/thread metadata, PID/TID inventory,
  flow counts and coverage requirements.
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

Exact-revision Chromium sources used for semantic checks (all under
https://github.com/chromium/chromium/blob/1de57fa19722fa6d6841d4f596c394d015580656/):

- gpu/command_buffer/service/scheduler.cc
- gpu/ipc/service/command_buffer_stub.cc
- cc/metrics/compositor_frame_reporter.cc
- components/viz/service/display/display.cc
- base/task/common/task_annotator.cc
- content/browser/devtools/protocol/tracing_handler.cc
- docs/life_of_a_frame.md

Official protocol references:

- https://chromedevtools.github.io/devtools-protocol/tot/Tracing/
- https://chromedevtools.github.io/devtools-protocol/tot/Profiler/
- https://chromedevtools.github.io/devtools-protocol/tot/IO/
