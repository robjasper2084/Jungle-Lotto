# Staged landmark authoring source

This is the recovered authoring generator from `Belle_Isle_GIS_Landmark_Corrections_2026-11-24`, with coordinated Conservatory vestibule and internal Show House connector repairs. The original package ZIP has SHA-256 `74d2eb591f1b5a9b4b67b679923b3cdf71b287cd26e00d8712e892fd9a597705`; its original `build_landmarks.py` has SHA-256 `56f9ce94908a5749fbb580ecb87716ead4dba69c4e8744d0055a686c6661944a`.

The game remains explicitly staged behind `VITE_STAGED_BELLE_ARCHITECTURE=1`. This repair aligns the model to the supplied game walls. It does not establish a surveyed footprint or height datum, change collision authority, or imply native acceptance.

## What changed

The original vestibule used two symmetric side panes centered at local v = ±4.6 m. The retained map has different positive and negative boundaries and rounded front corners. At local u = −12 m, the positive wall is at v = 5.3242324 m, and the negative wall is at v = −4.7532998 m.

The existing side panes now follow those separate wall segments. The front piers and sidelights follow the original front and corner segments. The transparent roof follows the same perimeter while preserving its inner edge and original west overhang. Every affected vertical coordinate, material, pane thickness and frame thickness remains the original value. The door header, jambs, threshold, dome and wings have identical primitive payloads to the original models. The separate Show House connector correction below changes only its west end glazing. Retained interior geometry and collision data are unchanged.

The generator keeps the original component selections in all three LODs. The added corner segments increase detail slightly; draw-group counts remain 25, 20 and 12. `source/vestibule_alignment.json` records the exact supplied map segments, coordinate convention and original placement. The map blob is `e5c741279fe981b928c9fd4d58a72d72ae7cb017`, verified unchanged at follow-up base `ee7c4515826fdbaca780b11f8e58cc216855abad`.

## Internal Show House connector

The 9b43 staged model put a closed green-glass box at local u = 11.1 m across the existing open Palm House to Show House connection. Actual GLTFLoader rays and a sphere sweep found the glass where the unchanged game collision layout has an open passage. The material was already correctly loaded as BLEND with opacity 167/255 and depthWrite=false; no optical-property correction was needed.

The west pane is now one continuous closed U-shaped solid around the existing connection. Its two opening sides follow retained map wall segments 17 and 32 at both faces of the original 0.055 m pane thickness. The transom begins at local y = 3.5 m, matching the existing Palm House drum's open base. The original pane's outer bounds, side glazing, far exterior end pane and all greenGlass material properties remain. A single connected solid avoids coincident interfaces between separate side/transom boxes. The same authored change appears in all three LODs, adding 16 triangles per LOD and retaining their group selections.

`source/showhouse_connector_alignment.json` binds the dimensions to exact base `9b43b72acb72cfe69dd483614e5c2d95bb57a7ed` and the unchanged map blob. `source/conservatory-connector-before.json` records every primitive/material payload at that base and every other shipped GLB hash. The regression requires all 24/19/11 unaffected Conservatory primitives to remain exact, and separately binds all 12 ordered triangles of the far exterior pane inside the changed component. Every other shipped GLB remains byte-identical. No collider, placement, input trajectory or tolerance changes are part of this correction.

## Reproduce and check

From this directory, in an isolated Python environment, rebuild only the three reviewed Conservatory game assets:

```sh
python3 -m pip install -r requirements.txt
python3 rebuild_conservatory.py --assets ../../public/belle/staged-architecture
```

The command checks the exact map blob and both supplied wall excerpts, generates only the three Conservatory outputs into a temporary directory, and verifies all output hashes and counts against the reviewed staging manifest before writing. It hashes the other nine assets before and after and fails if any changed. It does not rewrite the manifest or those nine assets.

To regenerate and inspect the complete original study package separately:

```sh
python3 build_landmarks.py
python3 qa/check_models.py
```

The generator writes all twelve source studies into its local `models/` directory and records its output hashes and geometry counts in `qa/model_report.json`. Only these three repaired outputs replace staged game assets:

| Output | Triangles | SHA-256 |
| --- | ---: | --- |
| Conservatory_Architectural_Study.glb | 17,796 | `d4ca492b0c5d07f90c7e8a1e3a6369811e6fe765f15c73f707bd34c9d55f1ae2` |
| Conservatory_Architectural_Study_LOD1.glb | 16,248 | `6dc9148964da3db834563cefa68aa22883eef051bea15136b9f72ad3d614e20f` |
| Conservatory_Architectural_Study_LOD2.glb | 3,112 | `361951febb39f9b148b7298c10294d2a4c12590847b0021394fcbc4a24b5804e` |

The other nine shipped GLBs retain their original bytes. A newer exporter changes their GLB container encoding despite identical named primitive and material payloads, so they are deliberately not replaced by regeneration.

`source/showhouse-connector-generator.patch` records the change from the verified 9b43 generator. Reverse-applying it to a copy reproduces SHA-256 `716b9b6fff39112c7e770448c6f2cab55ccf9c6652506e1b12b4c06c495d16a8`. Then reverse-applying the retained `source/vestibule-generator.patch` reproduces the recovered original source file and its SHA-256 above. Regenerating the unmodified original source with these dependencies was independently compared with all twelve original GLBs: every named primitive attribute/index payload and material definition was identical.

## Evidence

All original 74 authoring checks and six added connector clearance/closed-glazing checks pass, including winding, closed opaque solids, triangle counts, monotonic LODs and standing doorway clearance. The receipt is in `qa/mesh_test_receipt.json`.

The historical `qa/conservatory_fit_receipt.json` compares the prior vestibule correction against the byte-verified original models. The current `qa/showhouse-connector-payload-receipt.json` binds the subsequent one-component correction against exact 9b43 and retains all other primitive, material and asset identities. `source/conservatory-original-components.json` preserves the original attribute/index digests, material definitions, vertical coordinates and component counts used by the game regression. The regression reads actual shipped GLBs and the original game map through the pinned Three GLTFLoader:

```sh
node --experimental-strip-types --test src/belle/stagedConservatoryFit.test.ts
```

Run that command from the game directory. Its seven checks verify both vestibule side boundaries, every front corner across all LODs, standing doorway rays, roof height, original component fidelity, the retained exterior pane, unchanged optical properties and other assets, and the open interior connector with actual-triangle sweeps at the unchanged 0.27 m player radius in both directions. It also requires positive side-glazing/transom contacts. The original 9b43 models fail the connector passage regression; the repaired models pass. The continuous read-only triangle sweep helper is shared with the staged contact proof and does not control actor movement.

Independent GLTFLoader rays at u = −12 m reduce the positive side axis error from 0.7242325 m to 0.000000055 m and the negative side error from 0.1532999 m to 0.000000134 m. `qa/actual-loader-fit-measurements.json` contains the sampled rays and observed faces. The remaining sub-micrometre residual is float32 storage precision.

These structural checks supplement the native proof. The unchanged native walk assertions still require real portal travel, visible and collision contact agreement within 0.35 m, and all eight camera captures on desktop and compact-phone layouts. The original full-scene performance gate remains 90 seconds, p95 frame interval at most 50 ms, and zero intervals over 250 ms. This source receipt does not substitute for those runs.
