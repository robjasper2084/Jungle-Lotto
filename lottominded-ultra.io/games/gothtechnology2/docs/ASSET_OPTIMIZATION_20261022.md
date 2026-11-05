# Lossless game-package optimization

Local packages, October 22, 2026. No production deployment in this pass.

| Package | Before | After | Reduction |
| --- | ---: | ---: | ---: |
| Swoop Detroit + Static Royale | 798,890,133 bytes | 698,416,369 bytes | 100,473,764 bytes |
| Elmwood Explorer | 356,379,569 bytes | 249,672,375 bytes | 106,707,194 bytes |
| Total | 1,155,269,702 bytes | 948,088,744 bytes | 207,180,958 bytes (17.93%) |

Sizes include all files in each game package, including optional stages, media,
collision files and the new optimization report. They are not first-load transfer
sizes or guaranteed physical disk-space savings: authoring exports remain saved,
and some previous preview files were hard-linked to those originals.

## Changes

- Reuse byte-identical embedded model textures within each portable game package.
- Convert 89 eligible PNG textures to lossless WebP only when smaller; compare
  decoded RGBA bytes before accepting. Preserve dimensions, alpha and color-profiled
  images. Keep image names referenced by generated JavaScript unchanged.
- Losslessly compress 194 GLBs with meshoptimizer; verify decoded buffer bytes.
- Preserve nodes, joints, animations, sockets, mesh/index order and collision data.
- Atomically replace generated assets so hard-linked authoring files stay intact.
- Run optimization automatically after mobile-rider generation in both game builders.
  Existing runtime loaders already support meshopt and WebP.

## Run again

From this game-package directory:

```powershell
npm run optimize:riding-assets
# Or one package:
node scripts/optimize-game-assets.mjs swoop-detroit
node scripts/optimize-game-assets.mjs elmwood-explorer
```

The ordinary `npm run build:riding-games` workflow also includes this step.
Reports are written to each generated package's `asset-optimization.json`.
Source assets and generated hashed JS/CSS bundles are not rewritten by this command.

## Verification

- 12 packaging/compression regression tests passed, including repeat-run stability,
  linked-original preservation and generated-code reference preservation.
- Both normal game-build preflights passed.
- All six game/studio HTML entry dependency checks passed.
- Compared 13 real assets to their authoring originals: five heroes in each package,
  both dog variants and Elmwood terrain. Nodes, skins, animation definitions,
  decoded accessor buffers and decoded texture pixels match.
- Browser smoke checks: Swoop riding, Royale arena/riding and Elmwood free ride
  load without console errors. Swoop emitted an existing shader precision warning.
- This pass does not establish sustained 60 FPS or resolve the previously reported
  opening stalls. GPU memory/triangle counts remain the same because this pass
  preserves visual detail. No iPad retest was performed.

Evidence: `C:/Users/digit/Documents/phone/output/three-game-startup-release-20261022/`
contains before/after inventories, optimization logs, tests, real-asset comparisons
and browser screenshots (`assets-swoop.png`, `assets-royale.png`, `assets-elmwood.png`).
