# Belle Isle Higgsfield world materials

The November 14 refresh uses 29 new Higgsfield GPT Image 2.6 images: 28 surface families plus a grayscale water-height source. All jobs completed. Their quoted submission cost was 29 credits against the user's new 500-credit ceiling; this is a submission ledger, not a billing reconciliation. No regeneration was needed.

`higgsfield-world-skins-plan.json` preserves the exact prompts and parameters. `higgsfield-world-skin-results.json` preserves the completed job IDs and provider URLs. `game/public/belle/skins/PROVENANCE.json` records source checksums, processing, runtime checksums and prior provenance.

`world-skins.blend` is an editable Blender 5.2 material library with labeled swatches and packed runtime textures. `tools/build-world-skins.py` performs the resampling, bounded mean-pigment matching, edge blending, detail-map derivation, water-normal conversion and library assembly in Blender; FFmpeg encodes the final WebPs. The original generated PNGs are retained locally in ignored `game/output/world-skins/raw/`, rather than increasing the repository and download size by about 200 MB.

From the game directory, with sources downloaded and FFmpeg on PATH:

```text
blender -b --factory-startup --python ../tools/build-world-skins.py
```

Runtime maps retain their existing URLs: 28 color maps at 1024 square, 28 detail maps at 512 square, and one water normal at 512 square. The 57 files total 14,334,856 bytes versus 13,125,164 previously. Detail red contains authored roughness variation and green contains luminance-derived microheight; these are artistic maps, not scanned physical measurements. Color is mean-matched to the established scene palette. Skin, fur, cloth, paint and similar identity-sensitive surfaces retain their original pigment/atlas and receive microdetail. Transparent foliage keeps its cutout atlas. Glass, sky, live instruments, road markings, signs and luminous optics retain their specialized rendering.

Static scenery, terrain, buildings, vegetation, props, playable riders and vehicles use the shared material pass. The refresh closes missing application paths for both boats, golf props, the slide sack, existing rider-instance rendering and the newly merged CORLEO ride. CORLEO source GLBs remain immutable; its readouts, visor and lamps retain their authored materials. It changes no networking or voice behavior. Dynamic material clones are owned and disposed by their actors. Redundant procedural grain on roads, concrete paths and shore banks was removed after real-game screenshots exposed diagonal banding.

Local validation: TypeScript and production Vite build; asset checksum/dimension/budget checks; actual built-game guide visits to the conservatory, Casino, beach approach, fountain, playground and golf center with all 57 textures loaded and no console/request errors. Both boats passed throttle, steering, braking, cockpit, pause, shore return and emulated-phone touch checks with the new maps. Browser captures are under `game/output/world-skins/browser/` and `game/output/boat-high/`. The guide tour captures the beach approach, not the whole shoreline. These results do not certify physical-phone or headset frame rates.
