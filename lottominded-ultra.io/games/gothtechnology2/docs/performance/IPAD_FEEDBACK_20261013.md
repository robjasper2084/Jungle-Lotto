# iPad feedback corrections — 13 October 2026

User hardware: 2020 iPad Pro, Chrome, two players on the same Wi-Fi. Release bb7fd0d9 loaded in about 25 seconds; the floating joystick worked, but riding down the Cut lagged. User reported microphone permission accepted then switched off, no audible voice, a missing camera shortcut, and poor Ultra detail.

Changes:
- All three games use the revised shared on-foot rig: restrained forward lean, opposing shoulder/hip rotation, relaxed flexing elbows, and continuous ankle velocity through lift-off and landing. Existing movement speeds, weapon overlays, grounding, crouch/prone and dismount rules are preserved. This is an original shooter-inspired gait using the existing rigs, not imported COD/PUBG animation assets.
- Shared voice preserves explicitly enabled open-mic intent through temporary document hiding. Capture pauses while hidden and resumes on return. Leaving voice still stops tracks. Push-to-talk remains selectable and cannot leave capture enabled after release.
- Voice opens to an explicit Open mic / Push to talk selector, microphone enable/mute, speaker, retry, channel and connection status. Browser-blocked playback has an Enable voice sound action. Track interruption/end and permission failures produce actionable status.
- Restored one-tap Camera shortcuts in Swoop and Elmwood; Royale retains its existing View control.
- Selecting a graphics preset clears stale overrides. The previous Smooth shortcut's settings are repaired when a different preset is already selected. Ultra restores 4096px texture limits, 4096px shadows and 600m draw distance. Manual HD/Ultra requests MSAA on tablets after restart; explicit Off still wins.
- Crowd neighbors are filtered before allocating obstacle records; passing and recovery scores are evaluated once per candidate. Off-screen traffic posing is skipped, and distant animation work is staggered. Visible scenery and crowd simulation rules are retained.

Verification:
- Walk/contact/controller/turning tests: 11 passed. Real packaged skeleton checks: all five hero models passed 24 phases at idle, walk, run and reverse; no invalid transforms, feet below floor, or rigid/overbent elbows. Animation likeness remains for user review.
- Shared voice lifecycle/protocol and graphics/frame-scheduling tests: 16 passed. Crowd intelligence/collision tests: 4 passed. Both app typechecks and the shared-core build passed.
- 60-agent, 30-second comparison against the prior crowd implementation: identical state at all 900 ticks. CPU time 446.8ms -> 294.1ms in this synthetic local run (not whole-game FPS or an iPad result).
- Local browser two-peer synthetic audio: both connected, ICE exchanged, no rejected signaling/errors, audio bytes received both ways. Explicit mute disabled the track. No human microphone recording; audibility across physical devices is still pending.
- Browser UI: Camera button visible, first-person switch confirmed. Smooth -> Ultra restored the full settings. A short desktop Cut ride at Ultra reported frame median 16.7ms, p95 33.4ms; this does not establish stable 60 FPS on iPad.

Physical-device retest remains required: same 3-minute Cut ride, load time, stutters/reloads, and two-way voice with open mic and explicit mute. Cross-network voice remains unverified; the prior test was same Wi-Fi.
