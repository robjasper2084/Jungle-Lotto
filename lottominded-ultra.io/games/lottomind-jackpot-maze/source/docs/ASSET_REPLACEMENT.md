# Asset replacement guide

## Runtime assets

- `../assets/mascot/mascot-atlas.webp`: 8 columns × 6 rows, frame size 181 × 181
- `../assets/villains/villains-atlas.webp`: 4 columns × 3 rows, frame size 362 × 362
- `../assets/villains/envy-crew-strip.webp`: 6 columns × 1 row, frame size 362 × 724
- `../assets/villains/jackpot-patrol-strip.webp`: 6 columns × 1 row, frame size 362 × 724
- `../assets/ui/icons/`: isolated 256 × 256 collectible and power-up icons
- `../assets/ui/detroit-street-sign-blank.webp`: reusable generated reflective Detroit street-sign plate with live Phaser text layered above it
- `../assets/environments/*.webp`: compressed 16:9 world plates

Keep frame dimensions, row order, transparent padding, and bottom-center anchors unchanged unless you also update `src/game/GameRuntime.ts`.

## Source assets

`source-assets/chroma/` preserves every generated flat-background master. `source-assets/processed/` preserves the full collectible and boss atlases. `source-assets/environments/` preserves full-resolution PNG world plates. `source-assets/production-originals/` holds the large PNG and audio masters that are intentionally excluded from the shipped game.

To regenerate cropped icons, PWA icons, and compressed environment plates:

```powershell
& "C:\Users\digit\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" scripts\process_assets.py
npm run validate:assets
```

The production pipeline uses one whole-strip generation pass per character family to reduce frame drift. Avoid independent frame-by-frame generation unless visual inconsistency is acceptable.

## Deduplicated production media

Game art and audio are now canonical in the repository's sibling `../assets/` tree, not in `source/public/assets/`. The `process_assets.py` generator writes directly to that canonical tree so it cannot accidentally restore 42 deleted duplicate development files. The regular NPM workflows stage temporary checksum-verified copies into the ignored `source/.generated-public/assets/` directory for Vite/PWA. If you intentionally regenerate canonical images, refresh the matching SHA/size entries in `scripts/public-assets.manifest.json` before building; the build refuses changed or missing media until its manifest is updated.
