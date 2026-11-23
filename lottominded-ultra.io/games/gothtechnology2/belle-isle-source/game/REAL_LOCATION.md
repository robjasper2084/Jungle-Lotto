# Real location in the web game

This feature adds optional browser location and compass support to the existing Belle Isle web game. It uses the game's current Three.js renderer and RideCore. No Unity build or JavaScript-to-Unity bridge is required for this implementation.

## Player controls

1. Open **Real location** from the ride menu or the island guide.
2. Choose **Use my location**. Only this deliberate action requests browser location access.
3. A usable fix adds a cyan **YOU · GPS** marker and an estimated accuracy area to the minimap. The map expands when needed to include both the device and the game rider.
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
- Follow is unavailable during connected or pending multiplayer sessions, local co-op, VR, races, trials, activities, fishing, golf, the slide, photography, or vehicle use. Switching modes or traveling in the game stops follow.
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

Run from this directory:

```sh
npm ci
npm run check
npm test
npm run build
```

The targeted GPS tests cover projection, uncertainty, stale/future/out-of-order fixes, jump rejection, stopped and superseded callbacks, high-accuracy restarts, permission failures, hidden tabs, compass orientation, separate presentation state, pending multiplayer joins and coordinate isolation. Panel tests exercise reduced-motion behavior and stopping a compass session without a valid heading using a minimal test fixture; they are not rendered-browser tests.

During preparation on 2026-11-23, TypeScript checking and all 40 initial GPS/compass/integration tests passed. The full suite ran 1,200 tests: 1,199 passed and one failed because a baseline golf fixture was absent from the sparse checkout. After restoring that existing fixture, all three tests in the affected golf file passed. All five additional panel tests passed, including reduced-motion behavior. The production build completed successfully with the existing large-chunk warning and a parent Astro-config warning from this partial checkout. No generated assets or bundles are included in the source change.

**Still required before release:** rendered desktop/phone layout and keyboard checks; real GPS/compass checks on supported devices; foreground/background, permission-denied and retry checks in the deployed HTTPS context; and frame-time/battery measurements with the full island loaded. The available preview browsers could not connect to the local server in this environment. No full-scene browser performance or real-device accuracy result is claimed.

Field review should check a known public landmark, walking slowly and standing still, rotating portrait/landscape, optional compass on/off, switching tabs, stopping/restarting location, losing accuracy, entering a multiplayer room, and returning to ordinary riding. Keep precise device positions out of exported logs or screenshots used for review.

Production publication remains a separate approval step under the repository's root `AGENTS.md`.
