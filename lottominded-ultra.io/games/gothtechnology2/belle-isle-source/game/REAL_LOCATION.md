# Real location in the web game

This feature adds optional browser location and compass support to the existing Belle Isle web game. It uses the game's current Three.js renderer and RideCore. No Unity build or JavaScript-to-Unity bridge is required for this implementation.

## Player controls

1. Open **Real location** from the ride menu or the island guide.
2. Choose **Use my location**. Only this deliberate action requests browser location access.
3. A usable fix adds a cyan **YOU · GPS** marker and an estimated accuracy area to the visible circular navigation map, with support for the legacy minimap as well. The map expands when needed to include both the device and the game rider.
4. During solo exploration, choose **Follow my location** to display the avatar at the device position. Follow requires clear, dry mapped ground and no conflicting activity or multiplayer session.
5. **Stop following** restores the ordinary game view where it was parked. **Stop location**, or **Stop** on the persistent location strip, also clears the current fix and stops the sensor watches.

The optional **Use device compass** button requests orientation access separately. Hold the screen fairly flat so its top edge has a meaningful horizontal direction. GPS travel direction is used when available without the compass; it does not tell which way a stationary player faces.

Location starts off on every load. Hiding the tab pauses it; returning requires **Resume location**. The game does not save permission preferences or restart a sensor watch automatically. Browser permission decisions remain under the browser's control.

## Behavior and privacy boundaries

- `realLocation.ts` validates and filters fixes. It does not log, persist or transmit coordinates. Only the current projected target and bounded filtering state are held in memory.
- `realCompass.ts` accepts north-referenced orientation, handles screen rotation, expires old readings and removes listeners when stopped or hidden.
- `realLocationPanel.ts` owns explicit opt-in controls, status text, marker drawing and presentation smoothing. The dialog uses native buttons, labels and focus restoration. The reduced-motion option removes the panel's extra display interpolation; the location filter still suppresses sensor jitter.
- `locationPresentation.ts` produces a separate on-foot pose. It never advances, resets or teleports `RideCore`.
- `main.ts` parks normal simulation while following. Multiplayer messages, activity progress and ride-profile diagnostics continue to use the normal simulation pose. GPS follow is excluded from those activity and profiling paths. Camera diagnostics are withheld during follow and the original camera is restored synchronously on exit.
- Follow is unavailable during connected or pending multiplayer sessions, local co-op, VR, races, trials, activities, fishing, golf, the slide, photography, or vehicle use, including Cadillac driving and exit transitions. Switching modes or traveling in the game stops follow.
- Location is local to this feature. No server endpoint, analytics event, route history, friend-location sharing or geofence reward was added. The device/browser location provider still operates under its own platform permissions and policies.

## Map alignment and validation defaults

The projection exactly matches `../tools/prepare-map.mjs` and `public/belle/map.json`:

| Setting | Value |
| --- | --- |
| Origin longitude | -83.00175 |
| Origin latitude | 42.34680 |
| X axis | East, metres |
| Y axis | Up; height comes from the game terrain |
| Z axis | South, metres |
| Conversion | `x = 111320 * cos(originLatitude) * (longitude - originLongitude)`; `z = -111320 * (latitude - originLatitude)` |
| Maximum accepted reported uncertainty | 30 m |
| Maximum fix age | 15 seconds, checked by acquisition and receipt age |
| Jump plausibility speed | 12 m/s, with bounded uncertainty/slack allowance |
| Location filtering time | 900 ms, plus a bounded stationary deadband |
| Compass expiry | 3 seconds without a valid heading |

Latitude in the cosine is converted to radians. The loaded map origin and axis metadata must match before positions are accepted. Marker containment uses the loaded map's geographic bounds; avatar follow additionally checks actual walkable terrain and obstruction clearance. GPS altitude is not used.

Poor accuracy, outside-map fixes, invalid coordinates, stale timestamps and implausible jumps remove the usable follow target. Follow does not automatically resume when the next good fix arrives. The player can choose it again. A clean retry restarts filtering, so a legitimate relocation after a long gap does not require reloading the game.

The scene and sensor estimates are approximate. This feature is for game exploration, not pedestrian or vehicle navigation.

## Hosting

Browser geolocation requires a secure context and the player's permission. Use HTTPS on the published game. A browser that cannot provide location keeps ordinary game controls available.

If the game is embedded across origins, the parent page's Permissions Policy and iframe `allow` configuration must permit geolocation for the actual game origin. Do not grant a wildcard just to make an embed work. Compass availability also depends on browser support, sensor permissions and device hardware. The direct game URL is useful when diagnosing an embed policy failure.

References:

- [MDN: Geolocation.watchPosition](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/watchPosition)
- [MDN: geolocation Permissions Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy/geolocation)
- [MDN: orientation permission](https://developer.mozilla.org/en-US/docs/Web/API/DeviceOrientationEvent/requestPermission_static)
- [MDN: GPS direction of travel](https://developer.mozilla.org/en-US/docs/Web/API/GeolocationCoordinates/heading)

## Verification and release status

### Rendered interface fixture

With the development server running, open `/qa/gps-ui.html`. This development-only entry imports the real location panel and the game's actual base/mobile styles into a same-origin frame. Its visible controls provide synthetic fixes, simulated visibility changes and compass events. A prominent label identifies simulated data, and the frame denies native sensor permissions. No real device location is requested. The entry is outside the production asset directory and is not linked or imported by the production game.

The fixture supports desktop, phone, tablet portrait/landscape and short landscape viewports. It exposes active/cleared simulated watches, follow state, focus and the first-frame presentation gap for reduced-motion checks. It validates rendered interface behavior; it does not replace a real browser permission prompt, an iPad sensor check, or rendering the full island.

### Full-scene aggregate timing

Add `?locationPerf=1` to the direct game URL (or `&locationPerf=1` if a query already exists). After the island is playable, close other panels, select 30 or 60 seconds, and choose **Start capture**. The overlay can be collapsed during the capture. Start separate captures with location off, with the GPS marker active, and with GPS follow active. Keep graphics settings, orientation and the frame cap consistent when comparing captures.

The recorder counts successful full-scene render calls, including GPS-follow frames that the existing located ride profiler deliberately excludes. It reports CPU completion-to-completion intervals, p50/p95/p99, submission rate, render-call CPU duration, stalls, initial wait and an unfinished trailing gap. These values are **not GPU completion times or proof of display presentation**. A hidden/unfocused tab, pause, modal, scene preparation, XR/co-op, reduced-scene diagnostic mode, or a change to viewport/frame cap/motion/pixel ratio interrupts the capture instead of silently mixing conditions.

Only bounded in-memory timings, viewport/settings and GPS state labels enter the copyable JSON report. It includes no coordinates, headings, camera positions, route, identity or absolute timestamps, and it performs no upload or persistent storage. **Remove QA** clears the capture and removes its listeners and UI. Without the exact query flag, no measurement UI or listeners are created. This instrumentation leaves rendering effects and frame pacing unchanged.

The sustained-profile CI retains the original 90-second riding gate and records two distinct GPS checks in its full-scene desktop/phone lanes:

- **Native browser emulation:** the actual browser geolocation API receives an initial synthetic fix. Normal game controls activate Follow. An emulated provider error must stop Follow; a later good fix must restore only the marker, without automatically resuming Follow. Stop then clears the marker and restores ordinary controls.
- **Deterministic sensor contract:** a fresh, isolated browser context loads the same built game with the existing profiler's saved graphics preferences and verifies them through the settings UI. This preserves the profiler's policy of preparing the selected graphics configuration during startup. Only this test context receives a `watchPosition` adapter that emits fresh synthetic fixes and never falls back to the runner's physical location. The real game then records three unchanged 30-second captures: location off, marker on, and follow on. This checks the full scene, application sensor contract and rendered controls. It does not test native permission prompts or uninterrupted native sensor delivery.

The distinction is necessary because Chromium's [`GeolocationImpl::SetOverride`](https://chromium.googlesource.com/chromium/src/+/lkgr/services/device/geolocation/geolocation_impl.cc) can deliver an unavailable result to a pending query before replacing the emulated position. Repeated native overrides therefore do not provide a continuous stream of good fixes for a sustained Follow test. Production behavior remains unchanged: unusable location stops Follow and the player must explicitly choose Follow again.

`gps-regression.json` identifies the native and deterministic scopes. `gps-{off,marker,follow}-timing.json` distinguishes full-scene GPS measurements from the original riding profile. Rendered marker/Stop behavior, unchanged settings, unobscured default controls, cleanup and the report's coordinate-free schema are checked. The fixture exists only in test scripts and adds no production hook. An emulated phone viewport on the CI Mac remains distinct from a physical phone or iPad.

Run from this directory:

```sh
npm ci
npm run check
npm test
npm run build
```

The targeted GPS tests cover projection, uncertainty, stale/future/out-of-order fixes, jump rejection, stopped and superseded callbacks, high-accuracy restarts, permission failures, hidden tabs, compass orientation, separate presentation state, pending multiplayer joins and coordinate isolation. Panel tests exercise reduced-motion behavior and stopping a compass session without a valid heading using a minimal test fixture; they are not rendered-browser tests.

Validation on 2026-11-23 used the current Cadillac web implementation from production commit `374b7a2e639b2727fd8f832042379020ec65136b`, merged into `upgrade-redesign`. Its Cadillac physics, hydraulics, vehicle presentation, cached minimap, first-ride objectives and expanded profiling were retained. GPS guards cover these newer paths as well. Stopping follow restores the hero and camera synchronously, even when no next animation frame runs.

- Project TypeScript checking passed.
- All **49 focused GPS, compass, panel and integration tests passed**, including reduced motion and immediate first-person/third-person restoration.
- The larger game run reported **1,563 tests: 1,560 passed and three failed because two baseline source fixtures were absent from the partial checkout**. Restoring the existing bridge material manifest and suited-character GLB resolved these failures; all **15 tests in the three affected files passed**, including Cadillac cabin and door-clearance checks.
- The separate asset-pack validation stage passed **11 tests**.
- The updated production build passed, including lossless landmark and startup-asset compression. It retains the existing large-bundle warning and a parent Astro-config warning from this partial checkout.

No failing check remained in the targeted reruns. The complete large suite was not repeated after those fixture restorations; the final GPS transition change was checked with the 49-test focused suite and project TypeScript check. The GPS implementation does not edit generated bundles. Existing development refinements to vegetation and shader warmup were preserved while reconciling the branch with production.

Follow-up verification on 2026-11-23 supersedes the earlier connection limitation:

- GitHub CI on GPS candidate `c0191859cfa05754bec11fc81f3eaf2e3ab30f5f`, checked out as PR merge `16548f4bd90a871d48327bc32bc515643d82dea8`, completed the full suite with **1,572 tests: 1,569 passed, three skipped and zero failed**, followed by **11/11 asset checks**. TypeScript and the production build passed.
- Both desktop and phone HUD acceptance jobs passed using the actual loaded 3D game. Phone coverage includes 390×844, 320×568, 390×340 and 844×390. These are browser layout/input checks, not physical-phone performance certification. [HUD CI evidence](https://github.com/robjasper2084/Jungle-Lotto/actions/runs/45276045932).
- The supported managed preview now connects. The cloud browser itself cannot create a WebGL context, so it cannot supply full-island frame-time measurements. No graphics security settings were altered to bypass this limitation.
- The actual location panel was rendered separately at 1280×800, 390×844, 820×1180, 1180×820 and 844×390. It stayed within the viewport, had no horizontal content overflow, retained 44px button heights, and provided vertical scrolling in short layouts.
- The rendered fixture exercised explicit opt-in, follow, poor-accuracy rejection, denied access and retry, simulated background pause with manual resume, separate compass activation and an east heading, Stop cleanup, Escape/focus restoration and reduced-motion presentation. The reduced-motion first-frame gap was zero; the ordinary smoothed presentation showed a nonzero gap. The measurements use synthetic inputs, not physical GPS.

See [the rendered QA record](../qa/gps-release-2026-11-23/README.md) for the screenshots, exact scope and evidence references. Full-scene GPU performance results and publication evidence must be read from the exact release workflow run; an in-progress or queued workflow is not a passing result.

The release integration also incorporates production update `3e68163e94d173395cf7a2f47bd37859cf1a3f47` (PR #209), preserving its Cadillac wire rims, road-contact alignment and animated-shadow fixes. A shared nonmutating presentation helper applies the same road alignment during ordinary rendering and synchronous GPS Stop restoration. Focused checks passed 23/23, including both camera modes on flat/raised pavement and unchanged simulation poses. Project typechecking and the local production build passed. The full local run had only the same two sparse-checkout fixture omissions after merging; restoring those tracked files yielded 15/15 passes in the three affected files, with the separate asset stage passing 11/11. Exact final full-suite counts belong to the new CI run.

### Corrections from the first full-game GPS run

The actual Mac/Metal phone-viewport run on candidate `7e82f325…` revealed that the default cinematic HUD displays a circular map while hiding the legacy minimap. GPS now draws through the same local-only panel callback onto the visible circular map, after the rider marker, and expands its range to contain the fix and estimated uncertainty. The CI helper selects the actual visible map without changing the HUD preset and checks both its rendered marker pixels and five unobscured interior points. The optional timing panel is docked below the phone map and on the left so it does not cover the map or toolbar.

That candidate also reported one interval over 250 ms in each phone riding lane: 282.4 ms in full mode and 317.2 ms in the reduced-scene diagnostic. Neither result is reclassified as passing. A concrete modal-boundary gap was corrected: opening and closing a dialog between rendered callbacks now invalidates that transition interval, and the GPS recorder explicitly interrupts. Genuine gameplay stalls without a modal remain counted; the existing p95 ≤ 50 ms and zero >250 ms gates are unchanged. Observation persists with the document across back/forward-cache restoration.

The unique contact-shadow shader is now included in the existing island preparation while its mesh stays hidden, removing that known first-use compilation path. These source corrections do not prove the earlier outliers were caused by either path. New exact-head browser results must establish the release outcome.

### Subsequent clock and browser-evidence corrections

Candidate `59b676d318bcfe6168ef1ed295cc15ecc8af9667`, tested as merge `8bb35debe3270f5ddfe503be777a6531a6983ce5` with the identical source tree, passed TypeScript checking, the production build, **1,595 tests with three skipped and zero failed**, and **11/11 asset checks**. Its phone HUD job passed. The animation-clock correction removed the previously observed negative-time exception from this phone run: focus and modal boundaries request a reset on the next animation callback, rather than assigning a later wall-clock timestamp to the simulation clock. Source-executed regression checks also retain an uninterrupted 300 ms gameplay stall.

That candidate's full-phone riding capture still **failed** the unchanged gate: frame p95 was **34.4 ms**, with **one 266.6 ms interval**. No application or failed-request errors were recorded. The saved CPU duration belongs to the receiving frame, and the independent scheduler probes began after the Settings transition, so those observations do not establish the cause of the preceding stall. The next diagnostic window starts before that transition and labels its broader observation scope; it does not omit initial gameplay frames or change the original riding measurement.

The same run's bounded UI trace recorded `tracking → unavailable → tracking` at the native test override's two-second refresh cadence. Follow stopped on the unavailable event, as designed. Off and marker timings completed, but the attempted Follow capture contained marker-only state; the normal Stop assertion and storage scan were not reached. These results remain failures and are not promoted to passes by the revised fixture. Exact results for the revised checks belong to their own workflow run. [Candidate evidence](https://github.com/robjasper2084/Jungle-Lotto/actions/runs/45293927611).

**Physical-device checks remain unexecuted:** real GPS/compass accuracy and heading on a phone/iPad, actual sensor permission prompts in the deployed HTTPS context, field foreground/background behavior, battery/thermal behavior, and GPS-follow timing with the complete scene on those devices. Browser emulation and synthetic input do not certify those results.

Field review should check a known public landmark, walking slowly and standing still, rotating portrait/landscape, optional compass on/off, switching tabs, stopping/restarting location, losing accuracy, entering a multiplayer room, and returning to ordinary riding. Keep precise device positions out of exported logs or screenshots used for review.

The user explicitly authorized merging and publishing after the available checks on 2026-11-23. Publication still requires a successful production deployment and verification of the exact live revision; this document alone does not claim a live release.
