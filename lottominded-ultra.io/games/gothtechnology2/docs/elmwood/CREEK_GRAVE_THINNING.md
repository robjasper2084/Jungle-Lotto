# Bloody Run Creek grave thinning — October 3, 2026

Local review only. Removed 143 of the 159 estimated grave markers within 20 metres of the two mapped open reaches of Bloody Run Creek: an 89.94% reduction. Sixteen remain, selected for broad spacing across both banks, with a minimum centre-to-centre separation of 38.17 metres. Culvert geometry is excluded from the creek-bank corridor.

The change covers decorative headstones, crosses, arched/weathered stones, ledgers, obelisks and urns. All retained placement records are unchanged. Scenery outside this corridor, mapped/named memorials, buildings, trees, flowers and benches are preserved. No new assets were generated. Removing obstructing graves also lets the existing blossom placement pass accept one additional safe creek tree, bringing its current result to 24.

## Source and synchronization

Actual standalone Explorer source data:
C:/Users/digit/Documents/phone/euc-detroit-riverwalk/public/elmwood/placements.json

Repository mirror:
C:/Users/digit/Documents/phone/_goth_swoop_release_20260916/lottominded-ultra.io/games/gothtechnology2/elmwood-source/public/elmwood/placements.json

Both files and the staged review placement asset are byte-identical, SHA-256 cac9db165c1e2340f33ff0eb46c71cabad58e24fae5d8a1b855db77bbfcb3af5. The authored array changes from 6,160 to 6,017 placements; the displayed instance count excludes mapped/reference placements. Every removed record and its original array index is retained in evidence/creek-grave-thinning.json for review or restoration. This receipt also records the baseline hash and retained marker coordinates.

## Validation actually run

From the actual euc-detroit-riverwalk project:

```text
node --experimental-transform-types --test src/detroit/elmwood-dressing-layout.test.ts src/detroit/elmwood-nature-sites.test.ts
```

Four tests passed, zero failed. These check lane/tree clearance, established landmark preservation, benches and the blossom placement pass against the changed map.

A Node TypeScript-module here-string reconstructed the original placement array from the removal receipt and initialized both real Rapier worlds. Collider count changed from 4,917 to 4,774, exactly 143 fewer. All removed marker records are absent from the new terrain and all sixteen retained records remain. Both worlds were freed after verification.

From the packaging root, a Node ES-module here-string invoked prepareElmwood() from scripts/build-elmwood-explorer.mjs and built only .game-builds/love-tag-review/elmwood-explorer. Build passed; log: ../love-tag/build-creek-thinning-preview.log. Existing Vite large-chunk warning remains. Original store/public arcade outputs were not promoted.

## LOVE TAG collision alignment

Added an optional product argument to scripts/export-love-tag-fixtures.mjs so this focused scenery update can regenerate Elmwood without changing Swoop's own fixture:

```text
node --experimental-transform-types scripts/export-love-tag-fixtures.mjs elmwood-explorer
```

PASS. The Elmwood fixture is now revision 20261003.2, hash dab18d0638db3746073199e1ee8d3cde01d2a14ef80539e899fc94eb5cfdcc35, with 103 lane edges, 40 spawn anchors and 560 arena colliders. Updated server and client source fixtures, repository mirror and staged Elmwood fixture are synchronized. The staged fixture was copied after the product build; it is the same untransformed JSON asset used by the standard packager. Swoop's own arena was not regenerated.

The existing local review service was restarted with node dist/server.js on port 8211 to load the updated fixture. Two independent actual Colyseus SDK sessions successfully created, looked up, joined and left an Elmwood room with the new fixture hash and a valid room code. See ../love-tag/evidence/creek-fixture-room-smoke.json. This is loopback compatibility evidence, not a full online round, LAN/device test or hosted-internet verification. Existing LOVE TAG acceptance failures and missing gates remain open.

## Actual rendered evidence

Normal UI: Explore landmarks → Settings → Landmarks → Bloody Run flowers and willows, then New creek overlook bench. Both rendered views show open banks and preserved vegetation/architecture. The southern view was also inspected with the existing reducedMotion=1 review option. No captured console errors. One settings click initially timed out; a fresh state check and semantic retry worked.

Screenshots:

- C:/Users/digit/.codex/visualizations/2026/09/05/01a073f6-892e-70c1-a9a8-7659bc278528/elmwood-creek-thinned-20261003.png
- C:/Users/digit/.codex/visualizations/2026/09/05/01a073f6-892e-70c1-a9a8-7659bc278528/elmwood-creek-thinned-bench-20261003.png

Updated local URL:
http://127.0.0.1:8212/Jungle-Lotto/lottominded-ultra.io/games/gothtechnology2/arcade/elmwood-explorer/elmwood.html?creek-thinned=20261003

Port 4181 and GitHub Pages are not this review package. No commit, push, deployment, paid provisioning or generation occurred. Physical touch/VR and a full creek riding or TAG round were not performed for this focused placement change.

## Next runnable task

For local review, use the updated URL and the two creek landmark viewpoints, or choose Ride Elmwood. Continue the broader unfinished multiplayer acceptance tasks in ../love-tag/STATUS.md against fixture revision 20261003.2; re-export fixtures if subsequent map physics changes.
