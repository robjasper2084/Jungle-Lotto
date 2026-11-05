# Cyclist traffic and calmer walking — 13 October 2026

## Changes

- Preserved the current walk/run animation, cadence, movement speeds and distance-matched foot planting. Reduced arm swing, elbow pumping, shoulder sway, wrist motion, foot lift and hip bounce. Shared by Swoop Detroit, Static Royale and Elmwood.
- Ambient bicycle packs now start in single file with 5.2-metre spacing on their existing mapped lanes. Opposing packs no longer start two abreast across the centre of the narrow trail.
- Cyclists brake with predictive headway, commit to clear passing lanes and use current simulation positions for avoidance. Nearby pedestrians, other riders and the companion are included. Swoop pedestrians also account for the ambient packs.
- Expensive passing-lane planning runs at 5 Hz; simulation remains at 20 Hz and display positions remain interpolated. This is not a sustained 60 FPS certification.

## Verification

- Core TypeScript and all three release entries build. Existing bundle-size warnings remain.
- 23 focused automated checks pass. The flat-route test runs 400 simulated seconds with a stationary player and both packs completing multiple laps. Another test blocks the corridor, removes the obstacle and checks all riders resume.
- The actual Wilkins map test runs 300 simulated seconds with the reproduced crowd seed, a stationary player, companion and moving city traffic. Every cyclist advances over 100 metres in the final minute; no permanent queue remains. Tests retain player clearance.
- All five hero models retain limb lengths, continuous skins, finite vertices and heading-independent poses. Walk/run foot contact and cycle-seam continuity pass. Mounted/dismounted adapters for all three games pass.
- Local browser review at Wilkins exercised riding, braking and walking. The integrated packs continued circulating; no browser errors were captured. This review does not replace the user's visual acceptance of the animation.

## Current unfinished work

The older 11 October audits are historical. FPS8 and the 13 October chat/voice release already include first-person hands, free on-foot turning, per-scope tuning, range, attacker replay, weighted fingers, cache and the current Jazz-world integration. These are not absent features.

Still open: a smaller collision representation and sustained 60 FPS/loading work; a full visual sign-off of every building, dock and storefront approach; authored higher-detail weapon-specific animation/art; physical 2020 iPad Pro retest; audible two-person cross-network voice and adverse-network testing; durable online hosting/TURN. The temporary relay is unchanged by this patch. No paid access or lease was extended.

Evidence: `evidence/traffic-walk-tests-20261013.log`, `evidence/traffic-walk-build-20261013.log`. Publishing status is recorded by the PR, Pages receipt and live verification separately.
