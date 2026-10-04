# Swoop pond-edge recovery — October 4, 2026

Local repair only; no commit, push, deployment or original package promotion.

The paused user rider was at local `(1776.15, -254.44)`, heading `0.7249`, around Chene Park's pond. The terrain slope beneath the visible water admitted the wheel between -0.18 and -0.25 m. The next wet sample blocked movement; clearing the jerk-limited motor every blocked tick also prevented sufficient uphill reverse force. Recovery previously treated the pond bed as valid ground.

Changed source files under `swoop-source/src/detroit`: `controller.ts`, `recovery.ts`, `world.ts`, new `water-recovery.test.ts`. Recovery and saved recovery support now reject water under the wheel and its support margin. Existing wet-bank positions can climb to land, with physical obstacle and actor sweeps retained. Water entry and flat/deeper travel remain blocked. The bank normal handles sub-millimetre startup steps whose ray heights quantize identically. Reachable layer-4 dock ground remains usable. Saved distance, score, audio and controls are retained.

Commands run in Swoop source:

```powershell
node --experimental-transform-types --test src/detroit/water-recovery.test.ts src/detroit/controller.test.ts src/detroit/bicycle-recovery.test.ts src/detroit/recoveryTraffic.test.ts src/detroit/race.test.ts
npx tsc --noEmit
```

32 tests passed, including actual reported-map bank reverse, dry recovery, recovery footprint, occupied space, traffic reservations, unchanged braking/reverse behavior and race courses. Typecheck passed. Initial new regressions failed before the repair; an intermediate uphill escape failure exposed both motor reset and float32 ray-height quantization. Final log: `love-tag/shoreline-recovery-20261004.log`.

Built only `.game-builds/love-tag-review/swoop-detroit` via `prepareSwoop().build(...)`; Vite build passed. Current local review entry: `http://127.0.0.1:8212/Jungle-Lotto/lottominded-ultra.io/games/gothtechnology2/arcade/swoop-detroit/`. Its HTML references `assets/detroit-DKFciJBW.js`. Original 4181 package still references `detroit-vnlrk61m.js`.

Browser evidence: existing user tab's Recover button moved the paused rider to `(1775.26,-253.64)`, height `5.319`, while retaining 623 points and 453.4 m. The rebuilt package rendered and drove from Chene Park / The Aretha entrance via Cruise to the pond bank. UI Recover returned it to `(1787.27,-353.63)`, height `5.145`, preserving 71.9 m; left paused. The exact original bank's reverse escape is covered by the real map/controller test, not a manually held-key browser claim. No hidden state injection was used. Reduced-motion behavior and touch layout are unchanged by this physics-only repair; physical phones remain untested.

Screenshots: `C:/Users/digit/.codex/visualizations/2026/09/05/01a073f6-892e-70c1-a9a8-7659bc278528/swoop-shoreline-recovered-20261004.png` and `swoop-shoreline-review-20261004.png` in the same directory. Source revisions remain in `love-tag/evidence/race-water-revisions-20261004.json`.

Next runnable task for the broader incomplete release remains the failed Elmwood LOVE TAG AI lane-boundary verification documented in `love-tag/STATUS.md`; this focused shoreline repair does not clear that failure or establish hosted multiplayer acceptance.
