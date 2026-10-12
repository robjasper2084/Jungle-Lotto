# FPS, hands and browser-loading completion pass — 2026-10-11

## Implemented and verified locally
- Authoritative free on-foot heading, camera-relative strafing and normalized diagonal movement. Mounted limits remain unchanged. Browser test crossed a full turn without a yaw stop.
- First-person forearms and hands rendered from the actual hero skeleton; shoulder armor excluded. HUD mouse transit no longer changes aim, and a new practice session resets aim.
- Blender-created glove meshes and 30 weighted finger joints per hero, with relaxed, weapon, support, fist and reload poses, exported for all five heroes. Editable Blender masters are in art/blender/finger-rigs-20261011.
- Independent iron/2x/4x/8x look, ADS and gyro gains, persisted locally.
- Downtown 10/25/50/100 metre shooting range, with score marks from actual authoritative projectile segments and collectible weapons/scopes. It is an offline training round and follows the match timer.
- Server-recorded attacker replay, restricted to the eliminated owner and visible historical opponents, with bounded chunks and request throttling. Field deaths retain the clearly labelled last-view fallback.
- Browser fixture transport separates binary physics from map JSON while preserving exact collision bytes and map identity. Downtown compressed transfer falls from 84,299,422 to 60,594,089 bytes (28.1%); the loader avoids a 308,914,037-byte base64 JSON expansion. The physics allocation is still 218,455,249 bytes.
- Three-game packaging includes the updated shared controls/loaders and finger assets. Unrelated concurrent lobby, dog and three-respawn experiments are excluded from this release. The reviewed engine retains the live single-respawn policy.

## Evidence
- docs/combat/evidence/fps-regressions.log: authoritative heading, strafing, fixture integrity, killcam privacy and field-death fallback.
- docs/combat/evidence/finger-scope-test.log: all five skinned rigs, weighted fingers, arm-only geometry and independent sensitivity preferences.
- docs/combat/evidence/range-20261011.json: compiled shots hit all four target distances in the real downtown collision map.
- love-tag-server/evidence/fps-reentry-killcam-20261011.json: actual socket delivery, safe respawn, protection, reconnect persistence, dead-owner replay, no living-owner replay and throttling.
- love-tag-server/evidence/fps-ten-20261011.json: ten automated clients, AI fill, movement, eleventh-seat rejection and same-actor reconnect.
- docs/combat/evidence/ipad-pro-2020-user-report-20261011.json: user reported 45–120 second load and several stutters on the prior cf1a8d48 live Swoop release in Chrome over Wi-Fi.

## Still open — not claimed complete
- User retest of the new binary-loader release on the 2020 iPad Pro, with instrumented sustained frame times and memory. No Android device is available.
- Two-person microphone/network result. Six or ten real humans have not been tested.
- Persistent authoritative hosting. The approved private relay is temporary, expires at 2026-10-12T00:58:48.492Z and requires the Windows host. Credentials are kept out of source and public assets.
- Complete visual traversal of buildings, docks, storefronts and both Jazz destinations; the whole map has not been visually signed off in this pass.
- Hero-by-hero visual contact polish beyond automated skin/joint validation and the armored hero first-person browser check.

Release status is recorded separately by the GitHub PR and Pages receipt; a local build is not a deployment.

