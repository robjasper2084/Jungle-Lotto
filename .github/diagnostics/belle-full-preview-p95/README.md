# Full preview p95 attribution

## Current extension: one bounded native GPU-process stack sample

This child diagnostic starts from completed source `2806fbd4f9b445177b0fd37c6a417ec844312d30`. Its application stays at `9d2162e39188dcd0e42565f398b736734e481f73`. The original #261 desktop failures remain **51.1 ms default / 60.9 ms preview p95**. This extension cannot replace those acceptance results and does not select a runtime repair.

The preceding complete capture identifies both IOSurface/Dawn scheduling-future waits and separate WebGL service spans. Its independent gap 132 starts 67.368769 seconds after the trusted W-keydown trace marker and lasts 184.7 ms, with 88.103 ms Dawn and 94.176 ms WebGL overlap. WebGL event 1428095 starts at 67.375934 seconds; the later Dawn event 1428644 starts at 67.469882 seconds. These facts support a predefined observation window; they do not predict recurrence.

The new external sampler schedules **one attempt 64,000 ms after the first successful original W-down operation completes**, requesting **8 seconds at a 10 ms sampling interval**. Original native down/up methods retain their receiver, arguments, return promises and failures. The 450 ms input heartbeat, original 90-second ride, GPS, original report and exit priority remain intact. Host operation bounds are recorded separately from browser-event and trace time; the old capture has no corresponding first-down completion host receipt, so the prior nominal trace window is not an exact host-time replay.

The collector selects exactly one browser and one GPU process through the existing browser CDP session, binds them to macOS process observations, verifies real/effective user, direct parent, official Chrome executable and native launch switches, and checks identity stability before and after sampling. It retains browser/system receipts, raw process observations, requested and observed timing, sampling stdout/stderr/report bytes and their hashes. No alternate target or automatic retry is permitted. A 30-second sample-process timeout and bounded termination handling do not change the existing 60-second trace flush, 28-minute native step, or 35-minute job limits.

Independent verification reparses the raw sample report, checks PID/parent/executable and unchanged browser/system identity, and verifies actual overlap against the conservative first-W-down-completed to first-W-up-requested host bracket. Requested eight seconds is not substituted for actual observed duration. Permission, attachment, identity, output, overlap or symbolization problems remain explicit limitations or failures. Raw aggregate stack counts are statistical observations; they cannot be converted into GPU milliseconds or uniquely assigned to a frame gap.

The decision after the single attempt is fixed: identifiable avoidable application work can motivate a narrowly tested lossless repair; a specific browser presentation/synchronization path can motivate a controlled compatibility comparison; supported scheduling/contention evidence can motivate a resource investigation. Missing useful attribution remains inconclusive. If symbols are unusable or only the already known wait location appears without additional work or a producer, do not repeat the same unchanged sampling attempt or claim a runtime fix.

The sole existing diagnostic workflow runs this child automatically only for head `upgrade-redesign-perf-268-native-stacks-20261127` targeting base `upgrade-redesign-perf-261-full-trace-20261127`; manual dispatch is restricted to that same head branch. It retains the complete original evidence artifact and an additional small native-stack packet for bounded retrieval. The small packet is not represented as a complete raw browser-trace/build archive. Every application file, original acceptance workflow, trace category, CPU interval, buffer, visible asset and input requirement is preserved.

The following sections retain the earlier diagnostic history.

This isolated diagnostic investigates the recurring full-desktop failures: #227 recorded 82.5 ms p95, and the separate #257 integration recorded 84.2 ms p95 with one 266.3 ms eligible interval. It uses the unchanged application source from #261, whose six original native first runs are complete: four passed, while default full desktop failed at 51.1 ms p95 and preview full desktop failed at 60.9 ms p95. Instrumented results are attribution evidence only. The original acceptance runs and every prior failure remain authoritative.

The first collector passed 52 focused local contract tests and independent source review before publication, but its native attempt exposed the asset-classification defect documented below. The direct-GLB image repair passed 78 focused tests; its subsequent native attempt exposed missing gzip-container provenance. The gzip extension passed 88 focused tests. This separate revision adds the targeted GPU category observations described below. Native execution and its result belong to the workflow artifacts; source publication alone does not establish successful collection, a causal runtime repair, or release acceptance.

The collector is adapted from #254's reduced desktop collector. The complete upstream sources are retained under `upstream/` with byte hashes in `upstream-manifest.json`. The stream parser and trace accumulator are reused. Application code, the c722 driver, GPS code, frame predicates and native input are not patched.

## Retained first failure and strict Blob-image repair

The first attempt at diagnostic head `d7145774a18d3f46080aa8db87daef0f87d526db`, run `45968368488` / job `140402444606`, failed both the original instrumented performance gate and collection validation. Its original report records 65.4 ms p95, a 234.8 ms maximum, zero eligible intervals above 250 ms, and passing GPS checks. Those values do not replace the uninstrumented 60.9 ms preview failure.

The collector rejected 63 same-origin `blob:` responses before reading their bodies. All occurred before capture. Their payload bytes, lengths and hashes were never archived, so the failed attempt cannot be retrospectively certified complete. Artifact `15185853809` retains that failure: 513525587 bytes, SHA256 `91a7d5f62f33cfde7a33fa6c3fc6eac1ed7ce5cf2533cd9197c9216d9e005f0d`. Its trace, CPU profile, original report, source archives and all errors remain unchanged.

The repair indexes embedded PNG/JPEG image bytes from every exact-built GLB2 file and `.glb.gz` delivery container before the browser starts. The index binds each candidate to the complete source-file hash, image and bufferView identity, exact BIN byte range or data-URI source span, payload hash and MIME type. Gzip provenance separately binds compressed source bytes and decoded GLB bytes; every image offset is explicitly in decoded coordinates. It records ordinary external images separately; they cannot authorize Blob responses. Unknown storage formats, escaping paths, malformed ranges and unsupported media types fail closed. See `EMBEDDED_ASSETS.md`.

The observer requires the exact original game origin, including its port. It captures and retains a same-origin Blob body before matching its bytes and MIME to the independently rebuilt image index. All valid duplicate source matches are retained; they do not identify which duplicate instance created the Blob URL. Unknown or mismatched bodies remain archived failures. HTTP files keep their full-inventory byte checks. The final validator independently replays every response, and both body/hash/write and binding completion must fit the unchanged absolute 60000 ms post-stop deadline.

The image-provenance repair left application head/tree, build flags and assets, original driver/GPS/input, trace categories, sampling rate, buffer size, native deadlines and acceptance rules unchanged. The additional image-body reads add unquantified observational overhead; no correction is applied to any frame result. The separate targeted GPU category addition below does not revise either failed attempt.

## Retained gzip-source failure and extension

The next attempt at diagnostic head `16db81a51e083c025b0fc8e2fd49fc18003cc431`, run `45976078477` / job `140428014340`, retained all response bodies but could not bind three images. Its original collection and validation remain failed. Artifact `15187882232` is 535741921 bytes, SHA256 `73b1b3cfe8070aec5784bd0838b5aa3d6ace6dc5af265158ffe77d19b2121a5b`. The preserved original report, source receipts, trace, CPU samples and errors are not rewritten by this extension.

Independent exact-byte comparison located two rejected JPEGs inside `belle/waterfront-detail.glb.gz` and one PNG inside `belle/nature/cherry.glb.gz`. The pinned production loader decompresses startup `.glb.gz` responses before `GLTFLoader.parseAsync`; the build's lossless packing step removes unpinned original GLBs. The preceding image index considered only direct `.glb` files, omitting these delivery containers.

The index now considers every exact-manifest `.glb.gz`, including all startup and CORLEO packages. It requires one gzip member with the pinned build's zero-flags header, a decoded size bounded by ISIZE and 128 MiB, full DEFLATE-member consumption, and matching CRC32 and decoded length. Additional members, trailing bytes, optional headers and malformed or unsupported decoded GLBs fail. Compressed hash/length, decoded GLB hash/length and decoded image ranges remain distinct. Direct-GLB records and all duplicate matches are retained. The extension runs during prelaunch/final source verification and leaves the browser observer and original collection deadlines unchanged.

## Separate GPU wait and scheduler observations

This revision starts from published diagnostic head `453958352a28346eff60acda1db3971d7e6efbe2`, tree `7f3467f7f4bf011ce62347468c36d0f2d309f95c`. All prior source snapshots, native runs and original failures remain separate. The application, source art, image index, driver, input, workflow and upstream copies are unchanged. The active `contract.mjs` appends only the literal category `gpu` to the original seven; it does not request `gpu.service`, `disabled-by-default-gpu.service`, additional wildcard categories or per-GL-call tracing.

The existing single `Tracing.getCategories` call remains at browser launch. `categories.query` retains its method, parameters, actual response or error, response-received flag and host start/finish timestamps. The available list, whether well formed, and whether it advertises the literal `gpu` are recorded separately. Empty, missing, malformed and failed enumeration remains advisory and is never rewritten into an advertised success. The prior native Chrome `158.0.8127.89` returned an empty launch-time list; a separate small local Chrome `158.0.8127.0` API probe returned an empty list immediately and a populated list after WebGL initialization. That different local browser does not certify native macOS availability, and this collector adds no query retry or second query.

`traceStart` retains the actual `Tracing.start` method and complete parameters passed to CDP, host start/finish timestamps, raw response and any error. The collector and independent validator require the exact eight-category request, unchanged 256 MiB configuration and original launch-before-arm ordering. A failed start stays a diagnostic failure; the original native W release, later GPS calls, original report and original exit priority still run.

Raw trace coverage provides the category-availability gate. During the mapped trusted first W-keydown to W-keyup interval, at least one known non-metadata event must contain `gpu` as a literal comma-separated category token and belong to either the mapped game renderer PID or a GPU process identified by trace metadata. Renderer and GPU-process counts, phase counts and first/last raw event references are reported separately. Event timestamps use the half-open native interval; finite PID, TID and timestamp are required, and `X` events require a finite nonnegative duration. Supported coverage phases are `B`, `E`, `X`, `I`, `i`, `b`, `e`, `n`, `s`, `t`, `f`, `R` and `C`. Metadata, malformed events, unrelated processes, `gpu.service` and `disabled-by-default-gpu.service` do not satisfy this gate. Absence of qualifying coverage is an explicit unsupported-coverage failure, with the full raw trace and original result retained.

The gate requires neither a client wait nor activity from both process roles. It proves only that the requested category emitted relevant native-window records. All raw phases, flow IDs, arguments and timestamps remain in the original trace archive; the summary does not reconstruct begin/end pairs or flow dependencies. No GL method, application clock, render fence, canvas method or GPU call is wrapped.

Public Chromium sources provide candidates for inspection: [`CommandBufferProxyImpl::WaitForGetOffset`](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/gpu/ipc/client/command_buffer_proxy_impl.cc), [`CommandBufferStub::OnWaitForGetOffsetInRange`](https://chromium.googlesource.com/chromium/src/+/cfe6cb9f72fa78cbc79f6b90d386bf3c2c337e3f/gpu/ipc/service/command_buffer_stub.cc), and [GPU scheduler flow scopes](https://chromium.googlesource.com/chromium/src/gpu/+/df937685a3f6d74f411fc8d38cc45605fb8a4d6d/command_buffer/service/scheduler.cc). These sources are not established as the source revision of the captured native Chrome binary. The actual `Browser.getVersion` receipt, source revision and emitted event schema must be considered before interpreting a name. A client function scope may include a fast path; a service wait-registration scope is not necessarily the entire pending wait. Absence of either event does not disprove blocking. A renderer-to-service dependency requires compatible native identifiers and verified event semantics, not overlapping durations or similar names.

Wall duration may include blocked or descheduled time. Raw `tdur` applies to its whole event and must not be clipped, pro-rated or added to nested scopes as CPU utilization. A GPU-process host task, scheduler flow or command-buffer wait does not measure GPU execution, queue depth or presentation. The original signed CPU deltas remain unmodified, and sample counts must not be converted into measured milliseconds. Independent observer gaps still cannot be equated with original eligible game rows.

The added category can increase trace volume, CPU overhead and flush work; its exact native cost is unmeasured. The unchanged `recordUntilFull` buffer can fill earlier. Buffer usage and all raw completion/loss/late-flush evidence remain archived, with the same failure predicates and absolute deadline. No expanded buffer, longer ride, retry, overhead subtraction or numeric acceptance correction is authorized by this extension.

## This is a new diagnostic build

The preview workflow retains source art, screenshots and profile reports, but does not retain its compiled preview `dist` or the response bodies consumed by its acceptance browser. The old #227 profile artifact contained 34 report/image members and no compiled build. The #261 workflow retains the same kind of profile output. Reconstructing the same source and three GLBs therefore does **not** prove byte-identical replay of the earlier preview build.

The prototype records `diagnosticBuild: true` and `failedBuildByteReplay: false` throughout. It creates and retains a complete new preview ZIP so that this diagnostic's own served bytes can subsequently be reproduced and checked. It does not inject a manual build marker or change `profile=1` to another query mode. The original driver's unavailable manual-build marker remains unchanged; provenance belongs in the separate evidence receipt.

| Frozen input | Value |
| --- | --- |
| Application head | `9d2162e39188dcd0e42565f398b736734e481f73` |
| Application tree | `5a7f56b36477b615b96b5e19094c3d11d9a4c6cf` |
| Original #261 preview run | `45960190700` |
| Its synthetic merge, with the same tree | `55ed556cda718d94636f42c75644a05e64117872` |
| Strict driver Git blob | `c722b5810a7693e5ece72ed00b4401e7cde7267a` |
| Strict driver SHA256 | `8f6af949083800c491b65e0709c04cc29eb5712634f744c5b912f76ce651fcf5` |
| GPS helper Git blob | `1ef56565ceb8892fb918a6848972ea8b9f37c2fd` |
| Static server Git blob | `86d780f2a77eff0e9e46beacd35a558903d3ec29` |
| Exact-candidate source-art artifact | `15182411775`, `polyhaven-opaque-review` |
| Source-art ZIP length | `204251647` bytes |
| Source-art ZIP SHA256 | `9e3cc0edeaf7a6fe4c95b7618b3c82cf0eeb9cb183439e141e73c2204fd5fbce` |

Source-art inspection reused one independently verified archive. The isolated workflow fetches fresh metadata for that same pinned immutable artifact and downloads it once on its runner, without a substitute or silent retry. Its exact metadata and complete ZIP are retained in the diagnostic evidence.

The three original medium-tier GLBs are independently pinned:

| File | Bytes | SHA256 |
| --- | ---: | --- |
| `boulder-automatic.glb` | 5193764 | `a50c56ecf25cbe1b82f1a0211e9433d2695f4224017dfe3a820d160d6b0a035e` |
| `moss-1-automatic.glb` | 4210124 | `3d25cd5c7f3cda897382f1a216a1891d4011486d6baf2cd050cb24f8ddade859` |
| `moss-2-automatic.glb` | 4220544 | `35bfa44ed938a1ac450a4332cf62b78b686441336214e33093096ee9382e8d78` |

Independent inspection verified that all 43 source-art archive members match the earlier b80 artifact except `source-provenance.json`. The workflow independently binds the selected archive and its internal source provenance. This source-art equivalence does not imply compiled preview equality.

## Minimal adaptation

| Component | Change from #254 |
| --- | --- |
| `contract.mjs` | Pin #261 source/source art; require full desktop, original full URL and full-scene settings; bind the new complete build; validate both original verdict stages. |
| `build-preview.mjs` | Reconstruct one new preview in a fresh exact-head checkout, retain command logs, full ZIP and per-file inventory. No network, checkout, branch, commit, publish or trigger operation is implemented. |
| `preload.mjs` | Require full mode and an explicit disabled-by-default capture flag; run as an external Node import before the unchanged original driver. |
| `observer.mjs` | Full URL/report path, preview-loaded marker, pre-GPS error-prefix witness, bounded asset response receipts, explicit page coverage checks. Existing launch/input/stop/close forwarding remains. |
| `validate-evidence.mjs` | Recompute raw trace summary, verify full report and original exit, every consumed response body and absolute flush deadlines independently. |
| `archive-source.mjs` | Anticipate a separate frozen diagnostic checkout under `.github/diagnostics/belle-full-preview-p95/` and its workflow. The diagnostic commit is recorded separately from the application commit. |

For a later application candidate, freeze a new reviewed contract and artifact identity. Do not turn the head, driver or source-art pins into unconstrained environment overrides.

## Build preparation order

The future builder requires a **new** isolated application checkout at the exact head. It rejects all pre-existing tracked changes, untracked files and ignored files, including dependency folders, local environment files, staging and `dist`. It never cleans or deletes a caller's existing inputs. Run it before installing the parent browser runtime. Its evidence directory must not yet exist.

The disabled-by-default command interface is:

```sh
BELLE_TRACE_BUILD_AUTHORIZED=1 node "$bundle/build-preview.mjs" \
  "$workspace/app" "$workspace/evidence" \
  "$source_input/source-artifact.zip" "$source_input/source-artifact-metadata.json"
```

The builder validates source-art metadata, the full ZIP digest and length, safe archive member names, original GLB hashes, and internal head/tree/run provenance. It stages only the three established GLBs. It runs the original `npm ci`, `npm run check`, `npm test`, and `VITE_POLYHAVEN_ROCK_PREVIEW=1 npm run build`, retaining every command's status and log hash.

One existing generated research file can change its volatile `buildMs` field during the original build. The builder permits only that specific path, parses before/after JSON, requires all other values to be identical, archives both complete texts and hashes, then restores the exact original source bytes. Any other tracked change is a visible rejection. No geometry/data output is normalized or silently restored.

The complete `rebuilt-preview-dist.zip` is retained once, together with a full path/length/SHA256 inventory. Each ZIP member is decompressed, CRC-checked by the ZIP reader and hashed against that entire inventory. The live served `game/dist` is compared before and after capture. There is no duplicate retained build directory and no substitution of only the assets consumed on one route.

After the builder creates evidence, archive the distinct diagnostic checkout with `DIAGNOSTIC_EXPECTED_HEAD` set to its actual frozen commit. Then run the focused tests, install the original parent Playwright/Chrome runtime, and record host/browser information. The workflow is `.github/workflows/belle-full-preview-p95-attribution.yml`; the diagnostic source and that workflow are archived by exact Git blob, head and tree.

## Original execution stays intact

The c722 driver directly serves `game/dist`. It performs no build itself, so an externally loaded observer can inspect the already-built preview without copying or deriving the driver.

```sh
export BELLE_PROFILE_DEVICE=desktop
export BELLE_PROFILE_MODE=full
export BELLE_PROFILE_SECONDS=90
export BELLE_TRACE_CAPTURE_AUTHORIZED=1
export BELLE_STALL_EVIDENCE="$workspace/evidence"
export GITHUB_SHA=9d2162e39188dcd0e42565f398b736734e481f73
node --import "$bundle/preload.mjs" scripts/sustained-ride-profile.mjs
```

The application checkout and report name the actual 9d head. The earlier synthetic merge remains in the separate canonical-run receipt; no synthetic source identity is fabricated.

Preserve exactly `?profile=1&locationPerf=1`, High quality, 60 cap, pixel ratio/adaptive scale 1, 1440×900/DPR1, headed native macOS Chrome/ANGLE Metal, original ride selection, all menu/focus actions, 90-second W hold and 450 ms real-input heartbeat. The p95 ≤50 ms and zero eligible intervals >250 ms gates remain byte-for-byte in c722. Full GPS checks run afterward through their original controls and contexts. No route, scene, quality tier, render loop, game state, GL method, fence or clock is replaced.

The observer arms before the original native capture click. It issues CPU/trace stop when the exact original W-keyup promise completes, before subsequent GPS work. It preserves the native keyup promise identity, receiver, arguments, fulfillment and error. The original full driver still performs GPS checks and writes its full report before browser close.

The driver evaluates `baselinePassed` before GPS. Native GPS may later append errors to the same source-page arrays. Re-evaluating the baseline using the final arrays would rewrite history. The prototype independently mirrors the original source-page error formats from navigation, then snapshots their prefixes at the GPS helper's first synchronous `page.url()` call. The frozen helper reaches that call immediately after baseline evaluation, before another await or browser action. The synchronous URL method returns its exact native value.

The validator executes the exact baseline statements extracted from c722 on a clone using those witnessed prefixes, then executes c722's exact final baseline-and-GPS assignment using the complete final arrays. It never edits the original report. Missing GPS results, absent witnesses, unexpected exceptions or mismatched prefixes remain raw outcomes and make collection incomplete. An original nonzero exit always wins; otherwise a diagnostic validation/source/host failure fails the separate diagnostic job. No collection success clears a failed acceptance gate.

## Fixed collection limits and timestamp alignment

Keep the seven #254 categories: `toplevel`, `devtools.timeline`, `disabled-by-default-devtools.timeline`, `blink.user_timing`, `v8`, `disabled-by-default-v8.gc`, and `renderer.scheduler`; append only `gpu` in this separate revision. Keep CPU sampling at **1000 μs**, trace buffer **256 MiB**, `recordUntilFull`, and the original **60000 ms absolute post-stop deadline**. Keep the **28-minute step** and **35-minute job** in the new separate diagnostic; do not change the canonical preview workflow's deadlines.

The reduced #254 trace was 236630485 encoded bytes and 1119215 events. Its recorded trace-buffer usage peaked at 0.220701, with no data loss. Encoded JSON size is not buffer occupancy. Those observations do not predict this richer full-scene trace's size, cost or flush duration, and provide no reason to expand the buffer or deadlines.

Every emitted raw event is retained. Early, duplicate, malformed or late completion remains a failure. A timely completion event followed by a raw flush after the absolute deadline also fails. Late complete or partial bytes are preserved; cleanup does not convert that failure into success. Asset read/write completion is checked against the same post-stop deadline. The original native ride window is never extended to improve coverage.

Match the click, first trusted W-keydown and trusted W-keyup PerformanceMarks to native trace events from one renderer PID/TID. Reuse #254's consistent-offset check. Require actual positive-duration renderer timeline work and real CPU samples across the native boundaries; profile header bounds or process metadata alone are insufficient. Preserve signed CPU deltas, negative deltas and unsampled gaps. Do not interpolate a gap or turn self-sample counts into measured milliseconds.

The page observer records all retained independent RAF gaps above 50 ms, timestamped long tasks and supported long-animation-frame entries. Each bounded array retains up to 1024 entries and its exact overflow count. Any missing/malformed observation payload or nonzero drop counter prevents a complete page-attribution claim; raw trace and drop counts remain archived. Unsupported PerformanceObserver APIs are reported explicitly, not fabricated as measured zero work.

Keep rAF's supplied frame timestamps distinct from `performance.now()` at callback invocation. The first supplied frame timestamp can precede the click that armed this observer, even though invocation occurs afterward. Both are retained without clamping or arbitrary tolerance. Each slow independent gap includes both adjacent observer invocation times and native focus/visibility/settings transition revisions. Task/LoAF entries use interval overlap with the click→keyup window and retain their full durations.

These observations do not recreate the game's eligibility predicate. The existing original slow-frame rows still lack absolute timestamps and previous-callback identity. A matching rounded duration is only an ambiguous candidate association. Hidden, focus and menu transitions mark uncertainty; they do not authorize inventing eligible rows.

## What to analyze from a failed instrumented ride

For every independent slow interval across the complete native ride, retain its frame timestamps and callback invocation times, then inspect overlapping trace tasks and actual original game animation-callback scopes on the mapped renderer clock. Use the served bundle URL/generated function/line/column identity to distinguish the game's callback from the added observer callback. Associate expensive work with the preceding callback interval, not with the later render duration copied into a slow row.

Separate sampled JavaScript work, V8/GC events, style/layout events and other renderer tasks. Avoid double-counting nested inclusive timeline scopes; preserve raw event identity and state whether a reported quantity is a task duration, union of intervals or a self-sample count. Retain every relevant gap and all original failures rather than selecting only the worst one.

Browser/GPU-process `toplevel` tasks and renderer scheduling events can show concurrent host-process activity. The added literal `gpu` category may expose command-buffer wait or scheduling scopes under the limits above. Actual GPU execution, queue depth and presentation timing remain unestablished. A GPU-process task overlapping a quiet renderer gap is evidence of overlap, not a proved GPU bottleneck. The original browser pacing mode supplies no reason to propose an application fence fix.

Archive and hash every response body observed for the original page from startup through native release, checking it against the complete frozen `dist` inventory. Body extraction is limited to two concurrent requests, and each receipt includes host timing and whether the work started before/during/after the ride. The captured body is retained even when its hash check fails. Later GPS responses are outside this ride evidence window and remain governed by the unchanged driver's own error/report handling.

The extra asset reads, page callback, PerformanceObserver work, CPU sampling and tracing add **unquantified overhead**. Their timestamps and identifiable observer code should be retained for interpretation. No numeric overhead subtraction, ratio-based correction, causal application repair or acceptance conclusion follows from this instrumented run. Source mapping is permitted only if the generated code is byte-identical to the archived served bundle; otherwise retain generated locations.

## Verification and remaining conditions

Run the focused tests against the actual immutable driver/helper paths:

```sh
STRICT_DRIVER_PATH=/exact/game/scripts/sustained-ride-profile.mjs \
STRICT_GPS_PATH=/exact/game/scripts/gps-full-scene-check.mjs \
node --test full-mode.test.mjs embedded-assets.test.mjs asset-receipts.test.mjs upstream/observer.test.mjs \
  upstream/sustained-trace-json.test.mjs upstream/source.test.mjs
```

These tests cover the original lifecycle/forwarding, full query/report path, both exact verdict stages, later GPS errors, missing GPS evidence, every page-observation overflow/absence, preserved raw trace failure paths, late completion/flush/assets, exact source-art pins, original GLB hashes and complete ZIP membership. They also verify the exact added category/start configuration, raw advisory enumeration outcomes, native-window/role/phase coverage, nonliteral and malformed exclusions, and original W/GPS forwarding after zero coverage or trace-start failure. A VM case preserves a supplied RAF timestamp earlier than the click while recording its later invocation.

Local contract tests and syntax checks do not establish native Chrome collection, build duration, full-preview buffer use, response-body availability or instrumentation overhead. The workflow archives its diagnostic commit independently from 9d and preserves every original exit and artifact. Its resulting receipts must be inspected before making an attribution claim. A passing instrumented ride cannot replace or clear an uninstrumented acceptance failure.
