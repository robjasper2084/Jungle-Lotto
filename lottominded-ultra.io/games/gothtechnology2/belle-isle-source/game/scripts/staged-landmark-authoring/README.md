# Staged landmark authoring source

This is the recovered authoring generator from `Belle_Isle_GIS_Landmark_Corrections_2026-11-24`, with one coordinated Conservatory vestibule fit repair. The original package ZIP has SHA-256 `74d2eb591f1b5a9b4b67b679923b3cdf71b287cd26e00d8712e892fd9a597705`; its original `build_landmarks.py` has SHA-256 `56f9ce94908a5749fbb580ecb87716ead4dba69c4e8744d0055a686c6661944a`.

The game remains explicitly staged behind `VITE_STAGED_BELLE_ARCHITECTURE=1`. This repair aligns the model to the supplied game walls. It does not establish a surveyed footprint or height datum, change collision authority, or imply native acceptance.

## What changed

The original vestibule used two symmetric side panes centered at local v = ±4.6 m. The retained map has different positive and negative boundaries and rounded front corners. At local u = −12 m, the positive wall is at v = 5.3242324 m, and the negative wall is at v = −4.7532998 m.

The existing side panes now follow those separate wall segments. The front piers and sidelights follow the original front and corner segments. The transparent roof follows the same perimeter while preserving its inner edge and original west overhang. Every affected vertical coordinate, material, pane thickness and frame thickness remains the original value. The door header, jambs, threshold, dome, wings and display house have identical primitive payloads to the original models. Retained interior geometry and collision data are unchanged.

The generator keeps the original component selections in all three LODs. The added corner segments increase detail slightly; draw-group counts remain 25, 20 and 12. `source/vestibule_alignment.json` records the exact supplied map segments, coordinate convention and original placement. The map blob is `e5c741279fe981b928c9fd4d58a72d72ae7cb017`, verified unchanged at follow-up base `ee7c4515826fdbaca780b11f8e58cc216855abad`.

## Reproduce and check

From this directory, in an isolated Python environment, rebuild only the three reviewed Conservatory game assets:

```sh
python3 -m pip install -r requirements.txt
python3 rebuild_conservatory.py --assets ../../public/belle/staged-architecture
```

The command checks the exact map blob and supplied wall excerpt, generates only the three Conservatory outputs into a temporary directory, and verifies all output hashes and counts against the reviewed staging manifest before writing. It hashes the other nine assets before and after and fails if any changed. It does not rewrite the manifest or those nine assets.

To regenerate and inspect the complete original study package separately:

```sh
python3 build_landmarks.py
python3 qa/check_models.py
```

The generator writes all twelve source studies into its local `models/` directory and records its output hashes and geometry counts in `qa/model_report.json`. Only these three repaired outputs replace staged game assets:

| Output | Triangles | SHA-256 |
| --- | ---: | --- |
| Conservatory_Architectural_Study.glb | 17,780 | `312fb0530916d72e75aef4f33be47b66e1c1afb1a904070629132d3881d5565e` |
| Conservatory_Architectural_Study_LOD1.glb | 16,232 | `c1c28010258437a50647820aad6204cf947c78248771375e9dd57ad3273b0f2d` |
| Conservatory_Architectural_Study_LOD2.glb | 3,096 | `5ea972e8d027e0fb46eadd65faac0ec49a4377e5b8710b2f5f07d7e4a5bb6716` |

The other nine shipped GLBs retain their original bytes. A newer exporter changes their GLB container encoding despite identical named primitive and material payloads, so they are deliberately not replaced by regeneration.

`source/vestibule-generator.patch` records the complete change from the recovered original generator. Reverse-applying that patch to a copy reproduces the original source file and its SHA-256 above. Regenerating the unmodified original source with these dependencies was independently compared with all twelve original GLBs: every named primitive attribute/index payload and material definition was identical.

## Evidence

The original 74 authoring checks pass, including winding, closed opaque solids, triangle counts, monotonic LODs and standing doorway clearance. The receipt is in `qa/mesh_test_receipt.json`.

`qa/conservatory_fit_receipt.json` compares every named primitive against the byte-verified original models. `source/conservatory-original-components.json` preserves the original attribute/index digests, material definitions, vertical coordinates and component counts used by the game regression. The regression reads actual shipped GLBs and the original game map through the pinned Three GLTFLoader:

```sh
node --experimental-strip-types --test src/belle/stagedConservatoryFit.test.ts
```

Run that command from the game directory. It verifies both side boundaries, every front corner across all LODs, standing doorway rays, roof height and original component fidelity. The original models fail the two fit checks; the repaired models pass all four checks.

Independent GLTFLoader rays at u = −12 m reduce the positive side axis error from 0.7242325 m to 0.000000055 m and the negative side error from 0.1532999 m to 0.000000134 m. `qa/actual-loader-fit-measurements.json` contains the sampled rays and observed faces. The remaining sub-micrometre residual is float32 storage precision.

These structural checks supplement the native proof. The unchanged native walk assertions still require real portal travel, visible and collision contact agreement within 0.35 m, and all eight camera captures on desktop and compact-phone layouts. The original full-scene performance gate remains 90 seconds, p95 frame interval at most 50 ms, and zero intervals over 250 ms. This source receipt does not substitute for those runs.
