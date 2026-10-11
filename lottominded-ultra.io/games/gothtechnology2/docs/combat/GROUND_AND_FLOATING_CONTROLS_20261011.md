# Ground contact and floating controls

The reported Royale screenshots showed a dismounted rider passing through raised
pavement with a low camera and a dog stranded above its support surface.

Elevated street triangles now participate in authoritative body/projectile sweeps
and camera rays. Standing collision probes overlap through the entire torso and
head, removing the gap between the previous two sphere sweeps. Ground sampling
still distinguishes a bridge deck from the trail below. Camera clearance treats
low pavement beside a slope as a floor instead of forcing the eye underneath it.
Dogs spawn using their own support height and continue settling when a horizontal
route is blocked. Inventory, damage, parked wheel and re-entry rules are preserved.

Floating controls begin at the first finger contact in the movement half of the
screen in Swoop, Elmwood, Royale, the Jazz world and split-screen viewports. Existing
buttons remain interactive. A second finger cannot steal movement. Cancellation,
blur and release clear the stick. Swoop studio panels share a collapsed Nearby
places drawer above the movement controls.

Validation: reproduced raised-pavement body/ray failures in a small Rapier fixture
before the fix; regression covers raised sidewalk blocking, bridge traversal above
and below, both ray directions and camera clearance. Shared on-foot tests cover
all three adapters. Five shipped hero rigs retain foot/wheel contact away from
the world origin. Dog settling, ten-rider combat, spawn and single re-entry tests
pass. Swoop TypeScript and both game bundles build. Elmwood's full TypeScript check
still has previously recorded ImportMeta/test mock errors; its bundle builds.

The Unity Pages packager now names the new JazzPortal build and removes unused old
WebGL output from the deployment artifact. Immutable Unity source bytes are pinned
to the preceding reviewed commit. Publication requires the new PR's full build to
pass before merge, followed by a successful Pages deployment.

Physical iPad/Android and multi-network human voice checks, first-person arm/finger
rigging, free 360-degree combat aim, per-scope sensitivity, smaller collision data,
and a killer-perspective replay remain separate outstanding audit items.
