# Pinned phone stall attribution

This isolated diagnostic uses PR #213 application `61a9db36df072850f4bcea4536471e3d92e07453`, tree `097f7e68cb3407a7c55d2cfc945b428b63c847df`. The failed original run used synthetic merge `1a065ee46fb944d1a842058f65f0d0b9957c5dc2`, whose tree is identical. It reuses the exact original compiled `sustained-profile-game` artifact from run `45882624820`, artifact `15149081467`, ZIP SHA-256 `8cdd673784c04958e3ead4a8211d3ece44214bcd1dcb94214b3013f42fda5d0a`. If that artifact has expired, this diagnostic fails; it does not silently rebuild or substitute another build.

The original phone diagnostic recorded p95 33.5 ms and two eligible intervals over 250 ms: 267.6 ms near the Jefferson approach and 466.7 ms near Partners. Its aggregate observer found one 459 ms main-thread long task, but did not retain a task start time or stack. That suggests a main-thread investigation; it does not identify the responsible function or prove the 459 ms task and 466.7 ms interval were the same event.

The original strict driver remains byte-for-byte unchanged (Git blob `c722b5810a7693e5ece72ed00b4401e7cde7267a`). A separate derived driver contains only reversible additive calls that install read-only browser observations and a 2 ms V8 CPU sampler. The derivation verifies exact reverse equality. It does not change the application, URL query, route, trusted keyboard input, 450 ms input heartbeat, phone viewport, Smooth quality, cap60, DPR1, scale1, 90-second ride, numeric limits, result calculation, original report, or original workflow.

New evidence includes raw `renderer.cpuprofile`, timestamped native input boundaries, long tasks, long animation frames and available source locations, and RAF gaps. Entries overlapping a native input boundary retain full raw duration. The observer starts before the original profile button/menu/focus prelude and ends at the first genuine W-keyup. CPU profiling extends slightly beyond keyup while the original report is extracted; native event timestamps and bounded clock alignment distinguish those regions. Observer failures, unsupported entry types and bounded-buffer drops remain explicit.

V8 sampling and these browser observations add overhead. This is a diagnostic comparison only. A passing observed run cannot replace the failing uninstrumented result, close architecture acceptance, or authorize release. Original driver failures propagate to the workflow after artifacts are retained. Only one phone diagnostic case runs; no original production job is retried or modified.

## Local check

Set `STRICT_DRIVER_PATH` to the pinned original script, then run `node --test observer.test.mjs`. The workflow additionally verifies immutable source/tree identities and the original artifact digest, checks the generated driver's syntax, preserves source/driver receipts, and validates the collected evidence without changing the driver's verdict.
