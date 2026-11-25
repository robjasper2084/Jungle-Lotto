# Belle Isle facade study — safe branch installer

**Status: staging integration overlay, not a production build or deployment.**

This carries the exact **12 original GLBs** from `Belle_Isle_GIS_Landmark_Corrections_2026-11-24` with checksums verified against its `qa/model_report.json`. The two initial runtime subjects are the Conservatory and Aquarium; all three LODs are available for each. Scott Fountain and Conservatory Drive GLBs are included only for standalone art review. They are intentionally not installed as overlays over existing geometry: a flat base must not be stacked with the original fountain/cascade and unverified curbs must not alter driving surfaces.

## Run from a Git feature checkout (never main)

1. Create a **clean feature branch** from the latest `main` in the existing `robjasper2084/Jungle-Lotto` checkout.
2. Download and unzip this package. Run `python install_into_checkout.py --repo PATH_TO_Jungle-Lotto --check` first; it will report the branch name and verified source hashes without editing the checkout.
3. Run `python install_into_checkout.py --repo PATH_TO_Jungle-Lotto` to stage the exact GLBs and insert the opt-in world loader.
4. From `lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game` run `npm ci`, `npm run check`, `npm test`, and `npm run build`. These commands have **not been run on a full checkout in the current environment**.
5. Preview with `VITE_STAGED_BELLE_ARCHITECTURE=1` in a branch-only build. Without that explicit flag, all original production models and behavior remain in place. The staged GLBs are additional build assets in that branch and must not be merged just to get them into the Pages directory.

The installer refuses main/master and dirty worktrees and refuses to run twice. It tests exact asset hashes, expected anchor source text, and required import placement. No remote GitHub action, user account action, or production deploy is performed by the script.

## Runtime design

- Six GLBs (LOD0/LOD1/LOD2 for the Conservatory and Aquarium) are fetched/parsed and verified in sequence before any original facade mesh is detached.
- The model is placed using the game's existing legacy-local center/yaw and y=2 datum, not an unsupported survey-grade transform.
- LOD switching is 0/180/480 m with 0.12 hysteresis. The exact values are test hypotheses, **not** FPS or image acceptance.
- Legacy interior plant, tile/tank, and aquarium habitat meshes are preserved by a conservative name classifier. The replacement logic must be visually validated for every existing facade mesh before use.
- Failed model downloads or mismatched hashes abort a staged preview instead of leaving a partially replaced scene. The original mesh is never deleted from the asset file.
- Existing greenhouse/Aquarium collision, step support, garden furnishing, GPS, race gates, and flight solids remain untouched; entrance/clearance alignment remains a release gate.
- All existing fountain stone, water, and distal cascade components remain unchanged, preventing a double overlay.
- Glass does not cast solid mapped shadows. Other solid meshes use the game's existing shadow policy for acceptance.

## Required release evidence

1. At least one actual full-build source/asset identity report for the feature branch, all TypeScript tests, and all asset contracts.
2. Compare matched-angle first-person entrance and roof cameras with identical lighting in previous and staged builds, including no duplicated surfaces and preserved interiors.
3. Verify pathing and collision sweeps of the physical door and stairs, preserving accessibility without asserting ADA certification.
4. Validate a full 90-second actual native full-scene desktop and phone-viewport test at unchanged quality settings and real input, p95 frame intervals <=50 ms, and **zero** intervals >250 ms. Phone-viewport emulation is not equivalent to physical phone certification.
5. Only with verified checks, review and exact-source production deployment should the feature be considered for merge. There is no acceptance evidence yet for these models in the browser game.

To avoid confusion: this package makes it possible to stage *actual original model bytes* in the game, but it does not mean the models have been merged into the public GitHub Pages site.