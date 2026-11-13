# Belle Isle idle hover — isolated presentation feature

## Scope

Base: `d546de77fb304ebb3e113c676ff9d322c0535105`.
Isolated branch: `feature/belle-idle-hover-20261111`.
Do not overwrite the pinned release candidates in PRs #147, #148 or #149, and do not merge or deploy this feature under earlier release approval.

This change adds vertical heave to the existing solo playable HoverRide's render model. It does not alter HoverController, physical altitude hold, terrain collision, JARVS sensing/assist, multiplayer protocol, race rules, records, or ghost data. The full bike/rider/grip/LCD hierarchy moves together. No art assets, audio, dependencies, UI controls, timers, or rendering passes are added.

## Motion contract

- Primary amplitude: 0.05 metres, frequency 0.65 Hz, computed with `2 * Math.PI * frequencyHz * seconds`.
- Smooth deterministic wind: up to 0.008 m using two slow sine components; combined absolute displacement is bounded by 0.058 m.
- Only airborne, stationary, input-free flight is eligible. A 0.4-second settling dwell precedes an exponential blend-in.
- Actual displacement, vertical velocity and wrapped heading changes prevent strafing, coasting and turning from being mistaken for idle. Raw keyboard/touch intent is checked even when opposing keys cancel.
- Movement, braking, clutch, lift, boost, cruise, assisted lift, collision/hazard warnings and landing request remove eligibility. Input transitions blend out; touchdown, reduced motion and race ownership force zero.
- Clearance attenuates the effect close to terrain. This uses the existing terrain floor sample, not new collision geometry or obstacle scans. The feature does not certify that all possible near-ceiling visual clipping is eliminated; inspect constrained spaces in the real game.
- The clock is per-ride accepted frame time, not performance.now. Pause, focus loss, hidden tabs and invalid/long frame deltas do not advance the oscillator. Resume discards one delta to avoid catch-up. Reset, recovery, dismount and large teleports clear stale motion.
- First-person presentation is attenuated to 20%, with a smooth view-gain change. No offset is applied to the camera. Reduced motion overrides the effect immediately. Existing VR entry dismounts HoverRide; no XR camera motion is added.
- Competitive time-trial ownership disables the new offset. The existing separate co-op vehicle renderer is not changed by this solo-render feature.
- Read-only HUD attributes expose applied offset, blend strength and eligibility for real-browser inspection at the existing HUD refresh cadence.

## Verification completed locally

`node --experimental-strip-types --test src/belle/hoverIdleMotion.test.ts src/belle/hoverController.test.ts src/belle/droneFlight.test.ts src/belle/hoverCruise.test.ts src/belle/hoverTransmission.test.ts src/belle/flightCollision.test.ts`

Result: 64 passed, 0 failed, 0 skipped. Includes 28 new idle-hover tests and a paired real HoverController trajectory check across takeoff, idle, thrust, turns, strafe, braking and landing.

The new dependency-free motion module passed a focused strict TypeScript check. `git diff --check` passed. This local source-only workspace cannot install the game's dependencies; these results do not constitute full-project TypeScript, full registered suite, production build, GPU rendering, hardware performance or live deployment verification.

## Remaining acceptance gates

Run all existing release workflows on the exact candidate SHA with the new test registered in run-tests.mjs. Keep all original tests, thresholds, Pages size limits and manifest validation. Inspect actual rendered game behavior on desktop, 390x340 and 320x568: take off, settle, move/strafe/turn, brake, land, change view, use JARVS/radio controls, pause, background/resume, recover and dismount. Verify reduced motion and time trials remain still, grips/feet stay anchored, the camera does not bob, and geometry stays clear. No claim of measured FPS improvement is made.

When integrating PR #147, retain its full JARVS telemetry and seven LCD controls. This feature does not edit cockpitLcd.ts or cockpitTelemetry.ts. Merge the explicit test-list additions by union, not by replacing the existing runner. Preserve PR #149's cinematic controls and shader repairs and PR #148's shoreline/wildlife work.

## References

The user supplied YouTube videos `rYQSunLQiwo` and `ysE8FMhAPH0`. Their video content could not be played in this session; parameters follow the user's written specification, not claimed measurement of the footage. JavaScript Math.sin takes radians, hence the explicit Hz conversion.
