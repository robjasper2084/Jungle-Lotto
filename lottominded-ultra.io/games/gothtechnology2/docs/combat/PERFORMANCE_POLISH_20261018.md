# Riding-game performance and action polish

Applies to Swoop Detroit, Static Royale and Elmwood Explorer. The two generated game packages include all three playable entry pages, with their cinematic startup screens.

## Changes

- Shadows refresh at up to 30 Hz independently of gameplay input and animation. Teleports and explicit graphics changes force an immediate refresh; XR retains its normal refresh behavior.
- Nearby traffic rigs are created gradually, then reused in a bounded pool. Matching cyclist paint, clothing and skin materials share reference-counted resources. Distant community riders are not instantiated until needed.
- Hidden character and bird hierarchies skip render matrix traversal. Grass distance decisions are paced while wind and rider interaction remain continuous. Existing scenery detail, physics and population are retained.
- Royale permits Brawl with a stowed gun while still enforcing the authoritative draw delay for shooting. Prone holsters remain above ground, and first-person healing hands remain visible with the weapon stowed.
- Includes the prior local double-push cruise and Blender-authored idle, draw/holster and pickup-to-remount work. See HERO_ACTIONS_20261017.md and DOUBLE_PUSH_CRUISE_20261017.md for authoring details and limitations.
- Package validation follows transitive JavaScript imports to reject incomplete releases before promotion.
- The longer Wilkins/Mack ride exposed a second hotspot after retail streamed in. Penny display cases now retain their original tint/alpha using thin transparent glass, avoiding the whole-city transmission render pass. Photography frames and Penny signs batch compatible geometry; enclosed gallery/showroom furniture and shoppers stop rendering at distance with hysteresis. Close views and active visits retain the interior.
- Static batching preserves GPU attribute types, hidden-room transforms, transparent sorting and animated character hierarchies. Optional localhost `qaDrawCensus` telemetry identifies visible submissions; it is inactive on the public site.

## Verification

- 70 focused gameplay/render/animation tests passed, including real hero meshes, authoritative combat, reference-counted material disposal and rig reuse.
- 6 package promotion/dependency tests and 31 Pages assembly tests passed. Windows test temporary files were placed in the writable workspace; the assembly suite passed serially.
- Shared core, Swoop/Royale and Elmwood TypeScript checks passed with their configured compiler versions.
- Paired production game build passed. No generated hashed bundle was edited manually.
- Desktop browser: Swoop traveled from Gratiot through Adelaide toward Division, reaching 0.23 km and 67 km/h. At that sample: frame median 16.7 ms, 95th percentile 16.8 ms, CPU frame 10.3 ms, NVIDIA RTX 3080, automatic/High at pixel ratio 1.5. This is one desktop sample, not a controlled before/after benchmark or an iPad result.
- Royale browser: entered the shooting range, dismounted, holstered, entered Brawl, used Jab, returned to Weapon and went prone. No captured console errors. All five heroes' prone holster bounds and first-person healing visibility are also covered by regression tests.
- Elmwood browser: startup, female rider, riding, dismounted idle and pickup/remount checked; shadow refresh pacing observed.
- Follow-up: eight focused tests passed for interior hysteresis, exact transformed frame bounds, GPU attribute compatibility, glass material preservation, photograph placement and hidden-matrix behavior. Swoop/Royale and Elmwood type checks and the paired build passed.
- Wilkins before/after desktop samples, same route and approximately the same position: before at (-698.20,-52.61), 1,848 draw calls, median 33.3 ms / p95 33.5 ms, CPU 28.3 ms, automatic High already reduced to shadows off. After at (-694.32,-52.29), 751 draw calls, median 16.7 ms / p95 16.8 ms, CPU 11.9 ms, automatic High with 2048px shadows still enabled. Both had all retail loaded and 480-frame timing windows. Traffic is randomized; this is a repeat-route comparison, not a deterministic GPU benchmark. RTX 3080 desktop only.
- GothTech showroom and Penny interior were visually inspected after batching: nearby shoppers, merchandise, original photos and transparent display cases remained visible. A mixed GPU-attribute batching warning found during this check was corrected and covered by regression.

Physical iPad performance, sustained 60 FPS across every district, and new two-human online animation replication remain unverified. Unity batch rig validation remains limited by the existing Licensing Client issue described in the action-authoring report. This release does not renew a temporary relay or modify hosting permissions.
