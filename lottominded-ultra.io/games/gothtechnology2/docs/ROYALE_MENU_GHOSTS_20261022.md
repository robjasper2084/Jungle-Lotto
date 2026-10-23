# Royale menu, saved ghosts and AI recovery

## Implemented

- Retained the existing Higgsfield Detroit rider artwork. No additional paid generation was submitted.
- Replaced the round-results paragraph with a winner heading, elimination/damage/distance cards and expandable standings.
- Grouped rider/match fields and organized camera/control settings into keyboard-accessible disclosure groups. Existing controls are moved, not cloned, retaining their handlers and saved preferences.
- Added map-specific, bounded saved-run ghosts to Swoop, Royale and Elmwood. Recording and playback are explicit actions; only one translucent, non-colliding visual rider is created. Ghosts never count as combatants. A matching rider and wheel are required. Swoop/Elmwood online and replay modes suspend saved ghosts.
- AI riders now react to building impacts at lower speeds and complete recovery/remount phases quickly. Human recovery timing is unchanged.
- Distant ambient cyclists periodically plan avoidance at circuit turnarounds rather than remaining in a stopped pack indefinitely.

## Verification

- 27 targeted tests passed: AI wheel recovery/building impact, ambient circulation, ghost serialization/interpolation and raised-surface collision.
- Canonical RideCore build and Swoop/Elmwood type checks passed. All three game packages rebuilt through `build:riding-games`.
- Embedded-browser menu checked at desktop and 390 x 844. Native Settings disclosures open with Enter; existing reduced-motion CSS disables animation and transitions. This is not a physical-device retest.
- Royale deployed solo, recorded movement, saved a ghost and entered playback without console errors. Playback controls become available only during an eligible ride.
- Pages packaging now verifies and references 193 byte-identical textures at an immutable, already published commit. This avoids the previous 1,087.8 MiB Pages limit failure without reducing image quality. The source and local game builds retain their files.

## Still under investigation

- The reported raised sidewalk/rider position is not declared fixed. A sampled comparison of 7,236 upward street faces found one sidewalk with approximately 1.06 m difference from physical support; other discrepancies were roughly curb height. The exact screenshot location and whether overlapping geometry is intentional still require confirmation before changing collision.
- Sustained 60 FPS and the earlier iPad freezes remain unverified on physical hardware.
- Saved ghost playback adds one visual character and can incur first-use shader preparation. It is optional and disabled until explicitly started.
