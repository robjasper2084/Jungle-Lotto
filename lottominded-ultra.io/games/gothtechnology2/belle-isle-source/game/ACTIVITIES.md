# Swoop Dispatch and Photo Quest

Two activities share the existing Belle Isle world, rides, camera and map. Open them from the welcome screen or **Dispatch & Photo Quest** in the ride menu. During exploration, **J** opens the activity journal.

## Swoop Dispatch

| Contract | Goal | First-clear XP |
| --- | --- | ---: |
| First Drop | Collect at the island hub and complete one delivery, without a time target. | 80 |
| Two-Stop Sweep | Collect two parcels and deliver them in either order. | 100 |
| Cross-Island Express | Deliver to the farthest configured destination. | 120 |
| Pickup & Return | Collect a parcel away from the hub and bring it back. | 140 |
| Island Round | Complete three deliveries in any order, then return to the hub. | 160 |

Delivery stops are sampled from accessible paths in the real game map, near the bridge, Casino, Aquarium, Peace Carillon, Dossin Museum and lighthouse. The terrain collision checks reject water and blocked locations.

Follow the marker, stop, get off the ride with **F**, then press **B** or the on-screen handoff button. On a hoverbike, land with **G** before stepping off. A handoff requires walking mode, speed at or below 1.5 m/s, a horizontal distance at or below 7 m, and a height difference at or below 2.5 m.

The four timed contracts award medals against a soft time target. Late deliveries still complete. Menus, pause and hidden tabs stop the clock. Fast travel ends an active delivery; ordinary riding and walking preserve it. Best times are stored separately for wheel-only runs and runs that use the hoverbike.

## Photo Quest

| Assignment | Subject or requirement | First-clear XP |
| --- | --- | ---: |
| First Frame | James Scott fountain | 50 |
| Island Icon | Belle Isle Casino | 60 |
| Aquarium Story | Belle Isle Aquarium | 60 |
| Glass House | Conservatory | 70 |
| Tower Lines | Peace Carillon | 70 |
| Fine Detail | A closer photograph of the James Scott statue | 80 |
| Above It All | A featured landmark while riding the hoverbike at least 8 m above ground | 90 |
| Island Story | Three different featured landmarks | 120 |

Choose an assignment, find the subject, open the existing camera with **P**, then use **Space** or **Photo**. Each qualifying photograph must score at least 55/100. The three-photo story uses the average of its accepted photographs for the assignment medal.

Scoring uses the actual rendered camera, lens projection and saved image crop at shutter time. It checks the target's presence in the frame, projected size, framing, centering and visibility. Occlusion rays reject views blocked by buildings or other solid scene geometry. The player's own body, camera and activity markers do not block scoring. Transparent foliage is conservatively treated as solid where its material writes depth.

A successful still-image capture is required before awarding progress. Videos, failed image captures, duplicate subjects within one story, cancelled attempts and delayed callbacks from an old attempt cannot complete an assignment.

## Progress and album

The first completion of each activity earns its listed XP. Improving its best medal to silver adds 10 XP; gold adds another 10 XP. Replays preserve records without repeating first-clear rewards. Photo frames unlock at 200, 600 and 1,000 XP; the first frame is available immediately.

Progress is local to this browser under `belle-isle-activities-v1`. The album stores the latest 24 qualifying photographs in IndexedDB, with a bounded session fallback when persistent storage is unavailable. Album images are reduced to at most 1,600 pixels on their longest side. The original camera capture remains available through the existing capture controls. Album downloads include the selected Digital Static frame, with an original-image fallback if framing fails.

One activity can run at a time. Starting a race, fishing session or VR session ends the current activity and preserves completed records. The journal provides an explicit **End activity** action.

## Validation and release

From this directory:

```sh
npm ci
npm run check
npm test
npm run build
npm run preview
```

Validation on 2026-11-05: TypeScript check passed, all **266 tests** passed, and the production build passed. Coverage includes actual-map delivery anchors, handoff rules, pause and replay rules, duplicate reward prevention, crop-aware photo scoring, occlusion including transformed instanced meshes, and album storage failures.

Final integration review corrected the shared **B** listener so a delivery handoff cannot also mount the hoverbike. An isolated event regression and 46 relevant tests passed after that change. The frame clock also resets on visibility changes so returning from a suspended background tab does not charge the hidden interval to a delivery.

The mobile browser review found that the floating movement area covered the hoverbike's wrapped **Get off** button. Action buttons now sit above that area so touch players can dismount for a delivery handoff; the visual smoke uses the actual button to exercise this path.

The workspace's managed preview opens, but its browser cannot create a WebGL context. The Pages workflow therefore runs `scripts/activity-browser-smoke.mjs` against the newly built game on its existing browser runner. It requires a real WebGL scene and captures desktop, mobile, and reduced-motion journals, activity HUDs, camera mode, and actual capture feedback. The harness selects the existing Smooth graphics and 30 FPS target through the game's settings for the runner's software renderer; it does not change game defaults or seed activity progress. The `belle-isle-activity-visual` artifact contains screenshots and JSON results for review before publication. An ordinary fountain photograph is recorded as completed only if it genuinely qualifies. This smoke does not certify full delivery playthroughs, physical-device performance, or measured delivery target tuning.

Each visual case runs in a fresh full Chromium process. CI uses windowed Chromium on the runner's existing Xvfb virtual display, following Playwright's supported headed setup. The harness selects Playwright's legacy screenshot compatibility backend and records the browser mode, test version and capture backend in its report. Capture and cleanup deadlines preserve diagnostics when the software renderer stalls; a missing required screenshot still fails the gate.

The map catalog test reads the checked-out `public/belle/map.json` directly, so clean CI checkouts do not require an `origin/main` Git reference.

The repository's Pages workflow rebuilds `game/dist` and overlays it into the published Belle Isle route. Source changes are sufficient; do not hand-edit the archived hashed bundles. Work stays on `upgrade-redesign`. Root `AGENTS.md` requires explicit approval before production publication.
