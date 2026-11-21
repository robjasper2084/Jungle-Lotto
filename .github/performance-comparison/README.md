# Belle Isle paired performance comparison

This measurement-only harness compares the unchanged PR #175 source `a595ed97ec2ea970aedeb24695c1252c8abb3a0d` with the actual publicly served production source `71aa47004e8c7d9ff3ea2b49f771a0078f74b067`. It does not change gameplay, production, or the release candidate branch.

## Reproducible workload

- One GitHub runner executes baseline, candidate, candidate, baseline sequentially for each device profile. Each measurement uses a fresh browser. Independent desktop and phone cases use separate runners; comparisons are made within each case only.
- The same public Guide buttons visit Blue Heron Lagoon and MacArthur Bridge overlook. Both builds use the same map and shared landmark travel implementation. The benchmark holds those real player views stationary so different frame rates cannot cause route divergence.
- Both use noon, a stopped sky cycle, reduced motion, a 30-frame cap, and identical camera mode, quality, viewport and actual canvas pixel dimensions. Desktop High uses deviceScaleFactor 0.7 because the candidate's existing software-renderer policy otherwise changes its pixel count relative to production. Phone Smooth uses deviceScaleFactor 1.
- Normal Guide, Settings and Ride profile controls start and stop the built-in profiler. No simulated frames, scene substitutions, injected player poses, forced garbage collection or diagnostic scenery reductions are used.
- Every output preserves measured sample counts, actual active seconds, excluded/hidden time, observed game-update interval percentiles, stalls, draw calls, triangles, texture/geometry counts, available JavaScript heap and browser process memory, renderer identity and errors.
- Screenshots require actual new game frames and a real GPU fence outside the timed measurement window.

## Loading and evidence limits

The published version is fetched from its real URL, and its manifest and emitted files are hash verified. The candidate is built from its pinned source. Optional replay caching primes each version through its normal startup and Guide visits, then serves the exact captured GET response bytes to fresh browsers. This measures cold-browser startup with primed payload delivery; it does not claim to measure a player's internet connection. Initial unprimed timings retain their different network/local delivery context. Cache misses are reported and invalidate a strict controlled-loading claim for that phase.

The renderer is explicitly Chromium SwiftShader. Its timing is not physical desktop or iPad performance. In this software path the candidate also has an existing GPU queue fence while production does not; observed game-update intervals are therefore not interchangeable with displayed GPU throughput. Render submission CPU time is not GPU render time.

The profiler's p95 and p99 calculations are preserved, but low sample counts are disclosed. A p99 from fewer than 100 frames is effectively a maximum and cannot establish a stable tail regression. JavaScript heap, process proportional set size and texture object counts are different measurements; none is a GPU VRAM reading.

This is a matched stationary-view comparison. It does not replace continuous riding, race, co-op or physical-device endurance evidence. Results must be reviewed alongside the unchanged release checks before deployment.
