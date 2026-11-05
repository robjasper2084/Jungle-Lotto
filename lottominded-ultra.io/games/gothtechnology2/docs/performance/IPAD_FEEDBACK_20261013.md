# iPad feedback corrections — 13 October 2026

User hardware: 2020 iPad Pro, Chrome, two players on the same Wi-Fi. Release bb7fd0d9 loaded in about 25 seconds; the floating joystick worked, but riding down the Cut lagged. User reported microphone permission accepted then switched off, no audible voice, a missing camera shortcut, and poor Ultra detail.

Changes:
- All three games use the revised shared on-foot rig: captured pelvis/chest rotation and independently timed arm follow-through replace the flattened torso and mirrored arm swing. The head stays steadier and knees retain flex. Steps are centered below the hips instead of the forward mounted bind position; smooth reach constraints prevent abrupt hip dips during weight transfer, including both mascots. Existing movement speeds, weapon overlays, grounding, crouch/prone and dismount rules are preserved.
- The user-supplied [Star Wars Outlaws walking reference](https://www.reddit.com/r/StarWarsOutlaws/comments/1fe8sv1/the_game_has_cool_walking_animations_that_the/) was opened in external Chrome and the 41-second clip inspected as motion reference. Implementation uses the existing licensed local captures and original hero rigs; no game animation was extracted from the reference.
- Movement studio opens to Easy walk, with Brisk walk, Run and Walk backwards beside the hero/camera selectors. Other moves collapse under More movements. The canvas reserves control height so feet remain visible; reduced-motion users start paused.
- Shared voice preserves explicitly enabled open-mic intent through temporary document hiding. Capture pauses while hidden and resumes on return. Leaving voice still stops tracks. Push-to-talk remains selectable and cannot leave capture enabled after release.
- Voice opens to an explicit Open mic / Push to talk selector, microphone enable/mute, speaker, retry, channel and connection status. Browser-blocked playback has an Enable voice sound action. Track interruption/end and permission failures produce actionable status.
- Restored one-tap Camera shortcuts in Swoop and Elmwood; Royale retains its existing View control.
- Selecting a graphics preset clears stale overrides. The previous Smooth shortcut's settings are repaired when a different preset is already selected. Ultra restores 4096px texture limits, 4096px shadows and 600m draw distance. Manual HD/Ultra requests MSAA on tablets after restart; explicit Off still wins.
- Crowd neighbors are filtered before allocating obstacle records; passing and recovery scores are evaluated once per candidate. Off-screen traffic posing is skipped, and distant animation work is staggered. Visible scenery and crowd simulation rules are retained.

Verification:
- Walk/contact/controller/turning and real-rig tests: 12 passed. All five hero models passed 24 phases at idle, walk, run and reverse, plus a 96-sample easy-walk sweep checking knee flex, joint continuity and loop closure. No invalid transforms or feet below floor. Animation preference remains for user review.
- Blender 5.2 validation passed for all five retargeted heroes. Editable review scenes were saved locally under output/ipad-feedback-20261013/Blender; source meshes and prior Blender projects were preserved. Walking loop head drift stayed below 0.002 mm. These authoring files are not added to the mobile download.
- Shared voice lifecycle/protocol and graphics/frame-scheduling tests: 16 passed. Crowd intelligence/collision tests: 4 passed. Both app typechecks and the shared-core build passed.
- 60-agent, 30-second comparison against the prior crowd implementation: identical state at all 900 ticks. CPU time 446.8ms -> 294.1ms in this synthetic local run (not whole-game FPS or an iPad result).
- Local browser two-peer synthetic audio: both connected, ICE exchanged, no rejected signaling/errors, audio bytes received both ways. Explicit mute disabled the track. No human microphone recording; audibility across physical devices is still pending.
- Browser UI: Camera button visible, first-person switch confirmed. Smooth -> Ultra restored the full settings. A short desktop Cut ride at Ultra reported frame median 16.7ms, p95 33.4ms; this does not establish stable 60 FPS on iPad.

Physical-device retest remains required: same 3-minute Cut ride, load time, stutters/reloads, and two-way voice with open mic and explicit mute. Cross-network voice remains unverified; the prior test was same Wi-Fi.
