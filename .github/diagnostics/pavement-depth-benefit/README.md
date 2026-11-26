# Pavement depth-pass GPU elapsed diagnostic

This separate child diagnostic starts from the reviewed, still-unwired pavement prepass at commit c1a76acc94fffa0d54d2b2bf57c23ab522e01cde. It measures the complete render of the existing pavement/grass fixture on Apple Metal and SwiftShader. The original full-scene 90-second performance gate and controls deadline remain unchanged.

The independent zero-RGBA proof remains authoritative for targeted correctness. Its native Metal artifact 15148762458 has SHA-256 6daa6e28f721c077c5c7a1f80baf12790b80f044bfd5c140f997c17950fcc5f4. Timing results do not replace that proof or justify activating the helper in the full world.

## Identical source and workload

The compiler checks the exact existing fixture, helper, native chunks, factory, range helper and dependency lock hashes. It extracts the unchanged fixture setup, pose declarations and per-pose settings directly from that verified source, then adds a small timing entry. The generated source is archived and strictly type-checked. Original 759 grass/approach source fragments and material/decorator/assets retain their existing hashes.

The diagnostic commit may add only this namespace and its workflow relative to c1a76. Every public asset served to the browser is compared byte-for-byte with the c1a76 Git blob and archived by hash/size. The observed backend, source/tree identities, GPU-representable camera inputs, lighting settings, geometry/material owners and actual native submissions are recorded.

All six original actual-road cases are used: the recorded startup, island landing and far road, each in day and night settings. The camera bits and native call/triangle totals must also match the independently verified correctness receipt. Each frame includes the original color draws and original shadows, with only the candidate's extra depth draws added. Source draw order, indices, ranges, transforms and materials remain exact.

## Fixed balanced measurement

Each case renders four declared warmups in baseline/candidate/candidate/baseline order. Both original and candidate paths therefore complete twice, including shadows.

Each case then records all sixteen measured samples. The eight-sample sequence baseline/candidate/candidate/baseline/candidate/baseline/baseline/candidate repeats twice. Every adjacent pair contains one of each mode; the order is balanced. There are 120 queries in total: 24 warmup and 96 measured. Every sample remains in the raw report.

One EXT_disjoint_timer_query_webgl2 elapsed query brackets exactly one complete renderer.render call. The original shadow update remains enabled. The query ends before the existing asynchronous GPU fence and result polling. There is no readback, screenshot, extra render, GL finish, reduced quality or dropped draw inside a timed sample. CPU submission time is recorded separately. Elapsed queries measure the queued GPU interval and do not establish isolated shader occupancy or full-game FPS.

Query allocation, begin, end, completed fence, available result, deletion and disjoint observations are conserved for every sample. A missing extension, any disjoint observation, timeout, incomplete result, GL error, context loss or ownership/counter mismatch yields no performance conclusion. A final disjoint observation invalidates earlier results from that context as well. Raw returned values remain separately recorded as `observedNanoseconds`, even when they cannot be used. An attempted sample retains its native submission receipt and error if later fence/query completion fails.

The analysis reports every adjacent pair, per-mode mean/median/range/sample standard deviation, paired changes and spread, and first-half versus second-half drift. It does not select favorable samples. Valid improvements, neutral results and regressions all count as completed diagnostics. A slower result is not a retry trigger.

## Running and reviewing

The additive workflow uses the same Chrome launch modes as the existing proof. The actual backend string is checked. The child PR should target the c1a76 diagnostic branch so its new files do not retrigger the separate correctness workflow.

From the repository root:

    node --experimental-strip-types --test .github/diagnostics/pavement-depth-benefit/timer.test.ts .github/diagnostics/pavement-depth-benefit/contract.test.mjs
    node .github/diagnostics/pavement-depth-benefit/run.mjs --compile-only
    node .github/diagnostics/pavement-depth-benefit/run.mjs

The final command requires PAVEMENT_BENEFIT_SOURCE_SHA to equal the exact checkout. Artifacts preserve raw samples, generated source, source/asset receipts and analysis for every outcome. A compilation-only local path override exists for reviewing an isolated checkout; it is rejected for actual measurement.
