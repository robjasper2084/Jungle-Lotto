# Changelog

## 1.2.0 � 2026-09-30

- Shared two-contact bicycle controller, fitted player/NPC bicycle presentation, six color/accessory palettes and independent clothing/skin variants.
- Shared mapped-lane community event, pause/join/leave/rejoin/regroup/finish/cancel, local versioned completion record and bounded four-rider views.
- EUC controller behavior unchanged. New exports: cycling, cycling-view, community-panel.
- Actual source adapters live in Swoop Detroit and standalone Elmwood Explorer; local browser validation and limits are documented with the phase 2 report.

## 1.1.0 — 2026-09-16

- Added reference-authored hop arm sweep, asymmetric shoulder balance and delayed wrist relaxation.
- Elbows open naturally as hands rise; hand orientation follows the forearm more closely.
- Wheel suspension now loads during hop preparation and extends on takeoff, sharing pedal travel with foot IK.
- Preserved driving tuning, scrape/beep effects, human foot-down stops and both-pedals mascot stops.
- Reference and validation details: `docs/MOTION_REFERENCE_1.1.md`.

## 1.0.0 — 2026-09-15

- Named and saved the current mechanics as Digital Static RideCore.
- Extracted the existing Motion 4.1 controller and body solver without changing its simulation tuning.
- Added a fixed-step frame API, input edge buffering, event collection and human/mascot profiles.
- Removed Detroit-specific asset paths and world imports from the Three.js rider adapter.
- Included seven tricks, falls/recovery, terrain/camera contracts, audio, scrape sparks, touch state and companion logic.
- Added audio disposal and output diagnostics. The source game enables audio at start/resume and remembers mute preference.
- Included compiled ESM/declarations, source hashes, tests and integration/porting documentation.
- Added standard gamepad and Quest/Vive WebXR input adapters, a tracked VR view, in-headset HUD and optional comfort speed limit.
- Fixed held-charge release detection for touch, controller and XR hops; launch requests are independent of the held charge state.
