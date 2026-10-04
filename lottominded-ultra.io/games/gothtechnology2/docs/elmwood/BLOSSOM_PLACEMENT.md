# Elmwood blossom placement — October 3, 2026

Implemented in the actual standalone Explorer source and its packaging mirror. Source repository HEAD: aeb36453d24b1ab30798a2af78809bc639070aac on upgrade-redesign; working changes remain uncommitted. SHA-256 records are in ../love-tag/evidence/source-revisions.json.

## Result

- Enlarged and moved the crowded southern blossoms into open lawns to the east/right. The former seed near (27, 111 north) is now (55, 116.20 north), scale 1.65.
- Added a featured open-valley tree at (19.10, 146.78 north), scale 1.8.
- 23 accepted sites, up from 9: 3 entrance, 5 valley, 9 creek, 6 outer garden. All scales 1.35–1.8.
- Clearance accounts for the scaled crown, mapped paths, creek/pond, parking, buildings, monuments, existing large trees, other blossoms and ground slope. Trees are anchored to terrain. Unsafe candidates are omitted.
- Reused the existing native Blender cherry-blossom GLBs, birds and falling-petal system. No asset generation spend, new dependencies or renderer replacement. Existing bounded particles, distance culling and reduced-motion behavior retained.
- Settings → Landmarks → Cherry blossom valley now focuses the clearing through the normal UI.

## Changed source files

C:/Users/digit/Documents/phone/euc-detroit-riverwalk/src/detroit/elmwood-nature-sites.ts
C:/Users/digit/Documents/phone/euc-detroit-riverwalk/src/detroit/elmwood-nature-sites.test.ts
C:/Users/digit/Documents/phone/euc-detroit-riverwalk/src/detroit/elmwood.ts

The corresponding three files under C:/Users/digit/Documents/phone/_goth_swoop_release_20260916/lottominded-ultra.io/games/gothtechnology2/elmwood-source are byte-identical.

## Commands actually run

From C:/Users/digit/Documents/phone/euc-detroit-riverwalk:

    node --experimental-transform-types --test src/detroit/elmwood-nature-sites.test.ts src/detroit/elmwood-dressing-layout.test.ts

PASS: 4 tests, 0 failures. Validates larger crowns against real runtime dressing, path/water/landmark clearance, spacing and terrain anchoring.

    node node_modules/typescript/bin/tsc -p tsconfig.riverwalk.json --noEmit

PASS. Final subsequent camera-height adjustment changes numeric values only.

From C:/Users/digit/Documents/phone/_goth_swoop_release_20260916/lottominded-ultra.io/games/gothtechnology2, a Node ES-module here-string invoked prepareElmwood() from scripts/build-elmwood-explorer.mjs and plan.build(resolve('.game-builds/love-tag-review/elmwood-explorer')).

PASS; final entry assets/elmwood-mfDEs-Pq.js. Output log: ../love-tag/build-blossom-preview.log. Existing large-bundle warning remains; device performance is not established.

## Local browser evidence

Local review URL: http://127.0.0.1:8212/Jungle-Lotto/lottominded-ultra.io/games/gothtechnology2/arcade/elmwood-explorer/elmwood.html?blossoms=20261003

Normal UI used: Explore landmarks → Settings → Landmarks → Cherry blossom valley; also inspected Bloody Run flowers and willows. The actual rendered clearing and creek views show grounded flowering trees with clear roads and banks. DOM placement data matches the 23 accepted sites. Browser errors: none captured; existing Three.js PCFSoftShadowMap deprecation warning remains.

Screenshots:
C:/Users/digit/.codex/visualizations/2026/09/05/01a073f6-892e-70c1-a9a8-7659bc278528/elmwood-blossom-clearing-20261003.png
C:/Users/digit/.codex/visualizations/2026/09/05/01a073f6-892e-70c1-a9a8-7659bc278528/elmwood-blossom-creek-20261003.png

Effective browser DOM viewport 1706×960; IAB capture includes unused padding. All 23 sites have geometry checks; only these two location views received visual inspection.

## Release boundary and continuation

Local review package only. Existing port4181 store/public outputs and GitHub Pages were not promoted or overwritten; no commit/push/deploy. This focused scenery task does not complete the outstanding LOVE TAG or proposed MonoRace-style race work. The exact next multiplayer task remains in ../love-tag/STATUS.md.
