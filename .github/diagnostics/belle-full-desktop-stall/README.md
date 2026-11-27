# Pinned default full-desktop attribution

This separate diagnostic investigates the original default full-desktop failure on PR #257: **84.2 ms p95**, **266.3 ms maximum**, and **one eligible interval above 250 ms**. The original native W interval lasted **90,021 ms**. The full driver subsequently passed its original GPS checks; there were no application, request, or probe errors. The original failed result remains failed.

The matching #253 default desktop run passed with 33.9 ms p95 and no eligible intervals above 250 ms. Its starting world telemetry exactly matches the failed #257 default run. Both use High, DPR 1, scale 1, cap 60, native Metal, and browser frame pacing with no optional fence skips. The failed run has more long intervals and higher callback phase timings. These aggregate values cannot locate the responsible call stacks or establish a GPU or runner cause. The staged #257 desktop pass is a distinct build and cannot replace this default result.

## Exact inputs

| Input | Pin |
|---|---|
| Application head | `32f25acf9a681b75ebf2018de2cac4234d8b4b2f` |
| Application tree | `e51f2b769627f237db893d229ef5c827e6923058` |
| Original strict driver Git blob | `c722b5810a7693e5ece72ed00b4401e7cde7267a` |
| Original full-scene GPS checker Git blob | `1ef56565ceb8892fb918a6848972ea8b9f37c2fd` |
| Default build workflow | `45952596632` |
| Default build artifact | `15178554985`, `sustained-profile-game` |
| Default build ZIP bytes | `176624823` |
| Default build ZIP SHA-256 | `08e3277d7c4b46177e055a0a6ae9e364bf08e123f6c5d0b5931cfd622cae22fc` |
| Original failed job | `140368661729` |
| Original failed artifact | `15182110711`, `belle-sustained-profile-full-desktop` |
| Failed artifact ZIP SHA-256 | `e738ec3871989a51b514ba103d73b629d142078f08eef8f22063f99f03695194` |
| Failed raw report SHA-256 | `3427050357229841cba63b307718bb6df6757506664f549d8150d05f33989e4d` |

The original job used the GitHub synthetic merge `df95e5720114edb0d74077f1f0a841896eb8fb71`, whose complete source tree is identical to the pinned application head. The diagnostic checks out the actual application head and restores the exact original default ZIP. It verifies all extracted bytes and archives the immutable ZIP; it does not rebuild the application or add staged models.

## Original ride and GPS behavior

The workflow executes `scripts/sustained-ride-profile.mjs` directly with Node's external `--import` observer and its original full-desktop settings:

- `BELLE_PROFILE_DEVICE=desktop`, `BELLE_PROFILE_MODE=full`, `BELLE_PROFILE_SECONDS=90`.
- Exact original URL `?profile=1&locationPerf=1`, 1440 × 900 viewport, desktop and non-touch flags.
- High quality, cap 60, DPR 1, render scale 1, full scene, native Metal launch flags.
- Genuine native input and heartbeat, trusted W-keyup stop, original frame eligibility and p95 ≤50 ms / zero eligible intervals above 250 ms.
- Original full-scene GPS checker runs after the ride, including its native browser checks and context release. Its source is separately pinned and archived before execution, then rechecked after execution.
- Original 28-minute step and 35-minute job bounds.

The original driver is never rewritten or replaced. The verifier replays the baseline and final full/GPS expressions extracted from that exact driver. A failed ride or later GPS failure stays failed, and the original process exit takes precedence over diagnostic validation. Ambiguous evidence fails closed. The diagnostic-only classification never grants release acceptance.

## Bounded external capture

This adapts the independently verified #254 collector and the frozen #264 phone source. Only the namespace, selected full-desktop page and report path, full-scene/GPS evidence contract, and original GPS source receipt differ. Collector scheduling, algorithms, categories, sampling interval, buffer, and completion deadline are unchanged.

The capture arms before the original profile click. It retains profile/menu/focus transitions and the native ride, then requests trace and CPU stop at the original trusted W-keyup. Later GPS work stays in the original driver and is not substituted by another capture. There is no added warm-up, delay, scene reduction, input replacement, render wrapper, or application edit.

Seven categories remain enabled: `toplevel`, `devtools.timeline`, `disabled-by-default-devtools.timeline`, `blink.user_timing`, `v8`, `disabled-by-default-v8.gc`, and `renderer.scheduler`. CPU sampling remains 1 ms; the trace buffer remains 256 MiB with `recordUntilFull`. Broad per-command GPU tracing remains absent. Metadata alone cannot satisfy actual renderer or CPU sample coverage.

The absolute collection deadline remains **60,000 ms after native stop**. Completion observation begins before tracing and lasts through native browser-close settlement. Early, duplicate, malformed, missing, late, or data-loss completion remains an explicit failure. Recovered late bytes do not erase a timeout. Streaming writes and the incremental parser preserve raw input and partial failures with bounded memory.

Raw timestamped evidence includes renderer/browser/GPU process tasks, original signed CPU samples, independent RAF gaps, long tasks, long animation frames, native-input markers, browser-consumed JavaScript bodies, exact application/build/source receipts, and the unchanged original report. The full driver may release its source context during GPS checks; the collector retains the existing bounded context-close protection and does not start a second capture for later pages.

## Focused validation

Run all focused tests with `STRICT_DRIVER_PATH` pointing to the original driver; the pinned GPS checker must be in the same directory. Tests cover exact source identities, both original gate expressions, preserved GPS failures, native return/error semantics, source and immutable archive binding, trusted input, native boundary coverage, bounded streaming, failure retention, and the unchanged completion deadline.

This capture adds overhead and cannot replace any uninstrumented acceptance result. A source-mapped stack may justify a narrow runtime repair only after its executable bytes and timing coverage are verified. No runtime cause or repair is asserted here.
