# Pinned staged full-desktop attribution

This separate diagnostic investigates the original staged full-desktop failure on PR #266: **100.1 ms p95**, **299.5 ms maximum**, and **two eligible intervals above 250 ms** (299.5 and 250.2 ms). The original native W interval lasted **90,062 ms**. The original full-scene GPS checks passed separately; there were no application, request, or probe errors. The original failed result remains failed.

The earlier #257 staged desktop run passed with 49.8 ms p95 and no eligible interval above 250 ms. These two original cases share High, DPR 1, scale 1, cap 60, native Metal, and the original full-scene driver. Their aggregate callback timings cannot identify the responsible call stacks or establish a GPU or runner cause. No runtime cause or repair is asserted here.

## Exact inputs

| Input | Pin |
|---|---|
| Application head | `28ca0a857cc114a976c86fd0bd6fc86c93747e62` |
| Application tree | `0dbb01f0a5ba125c106502fe894dbfeef84a36db` |
| Original strict driver Git blob | `c722b5810a7693e5ece72ed00b4401e7cde7267a` |
| Original full-scene GPS checker Git blob | `1ef56565ceb8892fb918a6848972ea8b9f37c2fd` |
| Staged build workflow | `45966515259` |
| Staged build artifact | `15182819328`, `belle-staged-architecture-verified-build` |
| Staged build ZIP bytes | `176938133` |
| Staged build ZIP SHA-256 | `8cc39ea5f1aa3e4a5a41b05bedf2b03106bc6349f901133305c69d562bd4f89f` |
| Staged build index SHA-256 | `4a7d36b52b695f826266d6ec919032ff742c223ff740841beb25f352aaafdf6b` |
| Original failed job | `140399951018` |
| Original failed artifact | `15186166182`, `belle-staged-native-full-desktop` |
| Failed artifact ZIP SHA-256 | `011f64bd5749125a5c2ea06c790ca771e0117e75677b09470ccad65864717c60` |
| Failed raw report SHA-256 | `5093e83df78518cdb023e24004ce378d868e793a36b1e51d6a7ec2efe79080f8` |

The original staged job explicitly checked out the application head. Its report retained the workflow source context `9353d108bb9fd885b6c7823769263f8bf42e1b60`, whose complete source tree is identical to the pinned application head. The diagnostic checks out that application head and restores the exact original staged ZIP. It verifies every extracted byte and archives the immutable ZIP. The staged marker must bind the exact source, index hash, and `VITE_STAGED_BELLE_ARCHITECTURE=1` flag. No application rebuild or asset substitution is permitted.

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

This adapts the independently verified #265 full-desktop collector. Only the namespace, exact application/build pins, and staged source/index marker binding differ. The full-desktop page selection, original ride and GPS logic, collector scheduling, algorithms, categories, sampling interval, buffer, and completion deadline are unchanged.

The capture arms before the original profile click. It retains profile/menu/focus transitions and the native ride, then requests trace and CPU stop at the original trusted W-keyup. Later GPS work stays in the original driver and is not substituted by another capture. There is no added warm-up, delay, scene reduction, input replacement, render wrapper, or application edit.

Seven categories remain enabled: `toplevel`, `devtools.timeline`, `disabled-by-default-devtools.timeline`, `blink.user_timing`, `v8`, `disabled-by-default-v8.gc`, and `renderer.scheduler`. CPU sampling remains 1 ms; the trace buffer remains 256 MiB with `recordUntilFull`. Broad per-command GPU tracing remains absent. Metadata alone cannot satisfy actual renderer or CPU sample coverage.

The absolute collection deadline remains **60,000 ms after native stop**. Completion observation begins before tracing and lasts through native browser-close settlement. Early, duplicate, malformed, missing, late, or data-loss completion remains an explicit failure. Recovered late bytes do not erase a timeout. Streaming writes and the incremental parser preserve raw input and partial failures with bounded memory.

Raw timestamped evidence includes renderer/browser/GPU process tasks, original signed CPU samples, independent RAF gaps, long tasks, long animation frames, native-input markers, browser-consumed JavaScript bodies, exact application/build/source receipts, and the unchanged original report. The full driver may release its source context during GPS checks; the collector retains the existing bounded context-close protection and does not start a second capture for later pages.

## Focused validation

Run all focused tests with `STRICT_DRIVER_PATH` pointing to the original driver; the pinned GPS checker must be in the same directory. Tests cover exact source identities, both original gate expressions, preserved GPS failures, native return/error semantics, source and immutable archive binding, trusted input, native boundary coverage, bounded streaming, failure retention, and the unchanged completion deadline.

This capture adds overhead and cannot replace any uninstrumented acceptance result. A source-mapped stack may justify a narrow runtime repair only after its executable bytes and timing coverage are verified. No runtime cause or repair is asserted here.
