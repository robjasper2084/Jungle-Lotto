# Road and sidewalk surface repair — 10 October 2026

Scope: local source and review builds. No commit, push, live deployment, or authored-map replacement.

## Corrected behavior

- Shared Swoop Detroit / Static Royale street ribbons use convex joined footprints, preventing short bends from folding into overlapping triangles.
- Polygon clipping preserves boundary vertices on both sides. Touching a crossing no longer deletes unrelated approach triangles.
- Walking paths and narrow driveways meet the outer sidewalk edge. End caps centred inside the street corridor no longer spill into sidewalks or the opposite lawn; ordinary free ends remain rounded.
- Sidewalks and curbs respect adjoining asphalt segments, including segments of the same named street.
- Fine curb-ramp subdivisions stay inside the original sidewalk outline.
- Road markings follow joined boundaries; edge paint is clipped out of adjoining road footprints.

The normal Swoop riding surfaces use the resulting rendered triangles. Royale consumes the same city renderer. This change does not replace the arena's authoritative base-terrain fixtures or claim a new online physics acceptance pass.

## Verification

- 22 shared road geometry / junction regression tests passed, including the actual Atwater entrance, Mack driveway, Atwater inside corner, short bends, boundary-touch clipping, and preservation of long below-grade Dequindre Cut pavement.
- Swoop TypeScript check passed. Local Swoop/Royale and separately packaged Elmwood builds and package validation passed.
- 4 existing standalone Elmwood curb/terrain/RideCore tests passed. Elmwood uses a separate road implementation; its source was not changed by this repair.
- Browser inspection used the actual DetroitWorld and buildScenery implementation with simplified lighting and physics stubs to inspect geometry. Checked Atwater/Cut entrance, Atwater/Orleans, Mack Avenue, Chene/Atwater, and the tight Atwater bend. It is geometry evidence, not a completed gameplay or mobile-hardware test.
- Reproduced and removed the screenshot's asphalt fan at Atwater. Also visually verified the Mack driveway flicker and concrete corner protrusion were removed. No browser errors were recorded in the geometry review.
- Actual rebuilt Swoop gameplay: started Free Ride with the armored hero at Atwater, accelerated, travelled 0.15 km, braked and paused. No browser errors were recorded during this smoke test.

## Evidence

Local logs under the checkout's `.game-builds/`:

- `road-geometry-tests.log`
- `elmwood-road-tests.log`
- `road-typecheck.log`
- `road-surface-build.log`

Screenshots under `C:/Users/digit/Documents/phone/output/`:

- `atwater-sidewalk-fixed-20261010.png`
- `mack-sidewalk-fixed-20261010.png`
- `atwater-bend-fixed-20261010.png`
- `road-gameplay-check-20261010.png`

Local game review: `http://127.0.0.1:4191/arcade/swoop-detroit/index.html?engine=breadflower`.

Physical iPad/Android testing and an exhaustive street-by-street playthrough are not established by this repair.
