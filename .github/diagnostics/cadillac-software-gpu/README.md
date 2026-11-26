# Original Cadillac software renderer attribution

This is a separate three-frame diagnostic for the Linux SwiftShader throughput blocker in the original PR 210 controls lane. It does not run or replace the complete controls acceptance case. It does not establish Metal, hardware FPS, sustained ride performance, or human visual acceptance.

## Immutable inputs

- Application head: `75906273c0cd414c0d004320fc6f654b4783e5b1`.
- Source tree: `9f0351be133dd370a676090d27559a0adaf00605`.
- Original controls build run: `45839211197`.
- Original built artifact: `15127074963`, `cadillac-mods-game-75906273c0cd414c0d004320fc6f654b4783e5b1`.
- Artifact ZIP SHA-256: `ded31ca4e6658ab3edd5cbcd192a0ea0a57d8db79cd762ff9de7a23bb8409165`.
- Original build time: `2026-11-26T14:35:37.332Z`.
- Original index SHA-256: `9988025538e92f9613e72eee700c465981eb254ab635405f9f55ec8288f94646`.

The workflow checks out the app and diagnostic separately, verifies the original artifact metadata and complete ZIP digest, and serves those existing bytes. It does not rebuild or patch the game. A full file manifest is compared after the run. The original lifecycle, native-input, operation-timing, static-server and lossless CDP PNG helpers are pinned by Git blob ID in `pins.json`.

## Native setup and observation

The full original game opens at `?ride=cadillac&profile=1`. Native Start, Mods navigation, reduced-motion checkbox, Smooth selection, 30 fps selection and close Settings use verbatim function bodies derived from the pinned original controls driver. Desktop Chrome, Xvfb screen, 1280×800 viewport, DPR 1, and all SwiftShader launch flags match the original desktop lane. The full scene remains enabled.

After Settings closes, the observer arms once for exactly three ordinary top-level game renders. It obtains the original renderer through Three's existing devtools observe event. It records per-object draw/triangle counters, original camera matrices, and completion through the application's own fence protocol. It does not add a render, fence, blocking completion wait, scene setter, camera setter, gameplay input, or alternate route.

If `EXT_disjoint_timer_query_webgl2` is available, per-object elapsed queries are read asynchronously after the original frame fences complete. Missing, disjoint, pending and failed timings are kept explicit. Software GL elapsed-query durations are diagnostic measurements, not physical GPU certification. Query/JavaScript observation has overhead and this run is not an uninstrumented benchmark.

An original full-scene PNG follows the completed measurement, using the original GPU-completion fence, two paint opportunities and lossless CDP screenshot helper. The PNG is not part of the three-frame timed sample. Native document event receipts must all be trusted, and lifecycle issue/completion receipts are retained.

## Output and failure meaning

`report.json` includes initialization, settings, actual renderer, native inputs, observer data, source provenance, screenshot hash and all errors. `raw-observation.json` preserves every recorded per-object row and timing status. `dist-before.json` and `dist-after.json` establish unchanged build bytes. The original controls driver, generated native setup, its exact source-section receipts and complete diagnostic source are archived.

The diagnostic requires exactly three completed frames, complete observer coverage, conservation of the original native renderer counters, no truncated rows, the original viewport/backend/settings, and genuine Start/select input evidence. Its own bounded runtime is ten minutes with a twelve-minute workflow step. The original controls driver's 32-minute case and 34-minute exercise step, all assertions, every input and every required capture remain unchanged.

Local Node guard tests cover original source derivation, immutable artifact pins, changed build bytes, native input trust, completion, counters, settings and viewport. The shared work environment cannot open browser/Xorg sockets, so live execution requires the isolated CI workflow. A local syntax/test pass is not live evidence.

## Publication isolation

Publish these software-only files on a separate diagnostic branch based directly on the pinned application head. Leave PR 232's native diagnostic branch unchanged while its run is queued: GitHub `pull_request` path filters inspect the cumulative three-dot PR diff, so adding unrelated files to that existing PR could still retrigger its native workflow and cancel the queued run.

Primary workflow semantics: <https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow#git-diff-comparisons>.
