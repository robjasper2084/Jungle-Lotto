# Asset Manifest

## Active Raster Assets

| Key | Path | Use |
| --- | --- | --- |
| `hero` | `assets/hero/lottomind-hero-main.png` | Title image and HUD portrait source |
| `player` | `assets/mascot/lottomind-mascot-runner-atlas.png` | Runtime player animation atlas |
| `backplate` | `assets/backgrounds/higgsfield-soul-location-backplate.png` | Soul Location parallax depth layer |
| `foreground` | `assets/backgrounds/higgsfield-soul-location-foreground-ground.png` | Soul Location active gameplay background |
| `enemy` | `../gothtechnology2/assets/GOTHTECHNOLOGY_EXPANDED_SPRITE_PACK_V2/characters/KALYX/runtime_atlas_user/KALYX_RUNTIME_ATLAS.png` | Optional local enemy atlas for shield guards when available |

## Generated But Not Active

| Path | Reason |
| --- | --- |
| `assets/backgrounds/higgsfield-soul-location-far-parallax.png` | Preserved as a Higgsfield Soul Location iteration, but not wired because the render had an unwanted corner mark. |
| `assets/mascot/lottomind-mascot-runner-atlas-green.png` | Source/intermediate atlas before chroma cleanup. |
| `assets/mascot/master-ezra-*.png` | Earlier mascot exploration and legacy Shadow Ops atlas. |

## Code-Native Runtime Art

The current build draws these elements in Canvas so the full loop is playable without waiting for another asset-generation pass:

- Crawler, drone, turret, and boss silhouettes
- Heart bullets, enemy shots, pickups, floor hazards, gate, portal, particles
- Platform tile/circuit trim and vines
- DOM HUD hearts, meters, menus, results, and settings

These are intentional temporary production stand-ins. The matching generation prompts are listed in `ASSET_PROMPTS.md` for replacement with transparent sprite sheets.

## Higgsfield Soul Location Jobs

- Backplate: `9d5e3610-b033-4a65-825f-66cbfbf97c6c`
- Far parallax: `3de587f4-e766-40ea-bfec-7115713ad9f7`
- Foreground ground: `52fb6afa-fe65-4542-94bf-632dafedba35`

No provider tokens or secrets are stored in the project.
