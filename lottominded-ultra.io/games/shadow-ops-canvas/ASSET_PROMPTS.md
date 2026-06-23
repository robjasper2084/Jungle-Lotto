# Asset Prompts

These prompts document the Higgsfield Nano Banana 2 pass and the next recommended asset pass. Keep all art original to LottoMind and do not copy commercial game art, names, logos, sprites, or layouts.

## Generated In This Pass

### Level 1 Background

Original wide 2D side-scrolling cyber-jungle vault background layer, deep indigo forest silhouettes, violet mist, black-metal ruins traced with thin gold circuitry, sparse magenta energy, open readable gameplay space, no characters, no enemies, no collectibles, no HUD, no text, no logos, seamless/croppable landscape. Match the provided LottoMind concept screenshot: glossy premium toy-like 2D arcade art, black metal, gold circuit trim, neon purple and magenta energy, crisp readable side-scroller silhouettes, high contrast.

### Level 2 Background

Original wide 2D side-scrolling golden circuit foundry background layer, black-metal underground forge, glowing gold machinery, violet molten energy channels, conveyors, sparks, steam, casino-chip vault technology motifs, open readable gameplay space, no characters, no enemies, no collectibles, no HUD, no text, no logos, seamless/croppable landscape.

### Level 3 Background

Original wide 2D side-scrolling astral vault core background layer for a browser run-and-gun. Cosmic black sky, purple nebula mist, floating gold circuit platforms far in the distance, giant heart-core reactor glow, premium arcade game art, open readable gameplay space. No characters, no enemies, no collectibles, no HUD. Absolutely no readable text, no words, no letters, no digits, no signage, no logos; use only abstract tiny circuit dashes and unreadable holographic glyph-glow.

### Bosses

- Canopy Drone Queen: hovering black-and-purple vault drone queen, gold circuit wings, amber visor eye, magenta energy emitter, cute premium toy proportions but threatening, isolated full body.
- Jackpot Forge Titan: large black-metal mech with slot-machine vault-core chest, gold circuit armor, violet exhaust, heavy arms for ground slams, premium toy-like game art, isolated full body.
- Midas Heartcore Overlord: giant crowned black-and-gold AI guardian core, purple heart reactor, floating drone arms, gold circuitry, magenta halo, dramatic final-boss silhouette, isolated full body.

### Character Enemy Sprites

Base prompt: Production-ready 2D side-scrolling browser game enemy sprite for LottoMind Vault Run. Use the attached concept screenshot and hero as style reference: glossy black tech armor, gold circuit tracery, violet neon trim, amber visor/energy core, cute but combat-ready arcade proportions, crisp high-detail game art readable at small size. Single isolated subject on transparent PNG alpha. No scenery, no text, no labels, no UI, no floor, no shadow, no border, full body centered with generous padding.

- Low Crawler: compact low silhouette, four small articulated legs, side view facing left, body fits a 74x54 px hitbox.
- Hover Drone: round compact body, two small rotor pods with violet glow, dangling emitter, side view/front three-quarter facing left, body fits a 78x54 px hitbox.
- Shield Guard: humanoid cyber guard with black/gold armor, violet energy shield on front arm, side view facing left, full body upright, fits a 78x104 px hitbox.
- Turret: compact mounted cannon module with circular violet core and short barrel facing left, fits an 82x68 px hitbox.

Higgsfield returned opaque checkerboard previews for the first pass, so each sprite was passed through Higgsfield background removal, cropped to alpha bounds, and resized to a lightweight runtime PNG.

### Mission Motion And Branded Background Pass

Because local disk space was extremely low, this pass used compact local sprite construction rather than another high-resolution AI batch. The generated runtime sheets are transparent PNGs with original LottoMind M marks, gold circuitry, violet/cyan glow, and no third-party art:

- `mission_collectibles_sheet.png`: 8-frame rows for shards, keycards, health hearts, and overdrive medallions.
- `extraction_portal_sheet.png`: 8-frame extraction ring with gold, cyan, and magenta motion.
- `vault_gate_sheet.png`: 4-frame branded vault gate column with M lock plate and pulse states.
- `branded_background_props_sheet.png`: 3x2 prop sheet for medallions, terminals, relays, plaques, and signal cores placed behind platforms.

### UI

- Transparent gold sci-fi circuit frame for level title cards.
- Wide gold and purple boss health bar frame.
- LottoMind vault victory badge with gold circuit medallion and purple heart energy.

## Recommended Next Pass

### Player Sprite Sheet

Transparent PNG sprite sheet, 8 frames per row, bottom-center anchor consistent across all frames. Cute LottoMind cyber mascot hero, black cap with gold M emblem, purple hair/circuit face accents, black and gold tech jacket, compact heart blaster. Rows: idle, run right, run left, jump, crouch, crouch-shot, aim up, dash. Bright magenta heart-energy muzzle flashes, clean silhouette, no scenery, no labels.

### Enemy Animation Sheet

Future animation expansion: transparent PNG sprite sheet, original cyber vault enemy set. Rows: small ground crawler, hovering drone with purple rotors, shield guard with angular neon shield, wall turret with charge frame, hit flash, destroyed parts. Black graphite armor, gold circuit lines, purple/pink weapon energy, readable at small game scale.

### Clean Modular Tiles

Generate one tile sheet per level with no checkerboard preview background. Use a single flat chroma key color outside the art if true alpha is unavailable. Include straight pieces, end caps, corners, walls, moving-platform tile, conveyor tile, and hazard trim.
