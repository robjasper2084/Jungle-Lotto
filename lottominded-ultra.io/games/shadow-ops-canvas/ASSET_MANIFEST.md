# Asset Manifest

## Active Runtime Assets

| Key | Path | Use |
| --- | --- | --- |
| `hero` | `assets/hero/lottomind-hero-main.png` | Title image and HUD portrait source |
| `player` | `assets/mascot/lottomind-mascot-runner-atlas.png` | Runtime player animation atlas |
| `level1Bg` | `assets/levels/level1_bg_far.webp` | Level 1 Neon Jungle Vault background |
| `level2Bg` | `assets/levels/level2_bg_far.webp` | Level 2 Golden Circuit Foundry background |
| `level3Bg` | `assets/levels/level3_bg_far.webp` | Level 3 Astral Vault Core background |
| `level1Tiles` | `assets/levels/platform_tiles_level1_clean.png` | Active cleaned Level 1 modular platform source |
| `level2Tiles` | `assets/levels/platform_tiles_level2_clean.png` | Active cleaned Level 2 modular platform source |
| `level3Tiles` | `assets/levels/platform_tiles_level3_clean.png` | Active cleaned Level 3 modular platform source |
| `bossCanopy` | `assets/bosses/canopy_drone_queen.png` | Level 1 boss sprite |
| `bossForge` | `assets/bosses/jackpot_forge_titan.png` | Level 2 boss sprite |
| `bossMidas` | `assets/bosses/midas_heartcore_overlord.png` | Final boss sprite |
| `levelFrame` | `assets/ui/level_card_frame.png` | Canvas level intro and complete card frame |
| `victoryBadge` | `assets/ui/final_victory_badge.png` | Final victory card badge source |
| `enemyCrawler` | `assets/characters/enemy_crawler.png` | Standard ground crawler sprite |
| `enemyDrone` | `assets/characters/enemy_drone.png` | Standard hover drone sprite |
| `enemyShieldGuard` | `assets/characters/enemy_shield_guard.png` | Standard shield guard sprite |
| `enemyTurret` | `assets/characters/enemy_turret.png` | Standard wall/floor turret sprite |
| `enemyMotion` | `assets/characters/higgsfield_enemy_motion_sheet_alpha.png` | Active enemy animation overlay sheet for drones, crawlers, shield guards, and turrets |
| `missionCollectibles` | `assets/mission/mission_collectibles_sheet.png` | Animated shards, keycards, health hearts, and overdrive pickups |
| `missionPortal` | `assets/mission/extraction_portal_sheet.png` | Animated extraction portal ring |
| `missionGate` | `assets/mission/vault_gate_sheet.png` | Animated branded vault gate column |
| `missionBrandProps` | `assets/mission/branded_background_props_sheet.png` | Branded background medallions, terminals, relays, and plaques |
| `missionProps` | `assets/mission/higgsfield_background_props_sheet_alpha.png` | Active Higgsfield background prop cutouts layered into the level scenery |
| `fxSheet` | `assets/mission/higgsfield_mission_fx_collectibles_sheet_alpha.png` | Active Higgsfield heart shots, hit sparks, pickups, and mission effect cutouts |

## Generated Supporting Assets

| Path | Status |
| --- | --- |
| `assets/levels/platform_tiles_level1.png` | Higgsfield source art; retained as original download. |
| `assets/levels/platform_tiles_level2.png` | Higgsfield source art; retained as original download. |
| `assets/levels/platform_tiles_level3.png` | Higgsfield source art; retained as original download. |
| `assets/levels/platform_tiles_level1_clean.png` | Active runtime copy with preview background removed to alpha. |
| `assets/levels/platform_tiles_level2_clean.png` | Active runtime copy with preview background removed to alpha. |
| `assets/levels/platform_tiles_level3_clean.png` | Active runtime copy with preview background removed to alpha. |
| `assets/ui/boss_health_frame.png` | Generated and cleaned; retained for future DOM/CSS HUD integration. Current boss HUD is DOM/CSS for legibility. |
| `assets/mission/mission_collectibles_sheet.png` | Local optimized sprite sheet; active runtime pickup animation. |
| `assets/mission/extraction_portal_sheet.png` | Local optimized sprite sheet; active runtime extraction animation. |
| `assets/mission/vault_gate_sheet.png` | Local optimized sprite sheet; active runtime vault gate animation. |
| `assets/mission/branded_background_props_sheet.png` | Local optimized sprite sheet; active runtime branded background props. |
| `assets/characters/higgsfield_enemy_motion_sheet.webp` | Higgsfield source download for enemy motion; cleaned into active transparent PNG. |
| `assets/characters/higgsfield_enemy_motion_sheet_alpha.png` | Active transparent 3x4 enemy motion sheet. |
| `assets/mission/higgsfield_mission_fx_collectibles_sheet.webp` | Higgsfield source download for mission FX and pickups; cleaned into active transparent PNG. |
| `assets/mission/higgsfield_mission_fx_collectibles_sheet_alpha.png` | Active transparent 4x5 mission FX and pickup sheet. |
| `assets/mission/higgsfield_background_props_sheet.webp` | Higgsfield source download for branded background props; cleaned into active transparent PNG. |
| `assets/mission/higgsfield_background_props_sheet_alpha.png` | Active transparent 4x4 background/platform prop sheet. |
| `assets/mascot/higgsfield-hero-motion-atlas-1.webp` | Skipped hero generation; retained as source-only because the preferred runtime hero remains `lottomind-mascot-runner-atlas.png`. |
| `assets/mascot/higgsfield-hero-motion-atlas-2.webp` | Skipped hero generation; retained as source-only because the preferred runtime hero remains `lottomind-mascot-runner-atlas.png`. |

## Higgsfield Nano Banana 2 Jobs

| Asset | Job ID |
| --- | --- |
| `level1_bg_far.webp` | `6c39c332-f904-4c84-b169-06879650abc6` |
| `level2_bg_far.webp` | `d4878a23-cb6b-4fb3-86ad-a6692dd82a0c` |
| `level3_bg_far.webp` | `27ec2b6a-31b8-4616-846e-4b87e10a5a85` |
| `platform_tiles_level1.png` | `ad841d52-1af3-4805-8031-571c4aca5c79` |
| `platform_tiles_level2.png` | `1f5573c8-008a-4b9e-9405-86b8ed8bb3bd` |
| `platform_tiles_level3.png` | `45eda9e0-01ad-4316-9561-6bd4ed433b1e` |
| `canopy_drone_queen.png` | `73b8a80c-3303-4f8b-b8e0-f4887bd6ed92` |
| `jackpot_forge_titan.png` | `ebe51201-7b38-4a3b-a233-64b0815fde17` |
| `midas_heartcore_overlord.png` | `f2295ea8-7ee6-4d11-8867-9697250132cd` |
| `level_card_frame.png` | `affccc6b-4b99-43b4-bb12-e824d786bbba` |
| `boss_health_frame.png` | `cf9ebb8d-c87c-4f21-8867-309566b1d563` |
| `final_victory_badge.png` | `8c895fb4-1e38-4cdd-93c9-268a9cdf617f` |
| `enemy_crawler.png` | `bd5c5ed9-adf9-4e91-a0cf-d2770ef4e357`; cutout `c680910d-7915-4a9d-8400-add1d5fe8b86` |
| `enemy_drone.png` | `ce8700b8-45ac-441d-9c8a-179b70138fd4`; cutout `1315b451-82a6-411d-b06e-a484dfa109fd` |
| `enemy_shield_guard.png` | `efd14934-2c7c-407a-92a0-190e0df07e65`; cutout `85f10d55-af28-4e91-bfd6-53313266373f` |
| `enemy_turret.png` | `0223d8f6-cd42-4ca2-aab5-128d54045af2`; cutout `eb744f18-6033-4018-aa3d-318b3dd675da` |
| `higgsfield_enemy_motion_sheet_alpha.png` | `9e5dcb4a-7365-4fd4-85eb-be1c988219b9`; local checker cleanup |
| `higgsfield_mission_fx_collectibles_sheet_alpha.png` | `d8e8f39b-f163-42c9-89b8-d051947b61e9`; local checker cleanup |
| `higgsfield_background_props_sheet_alpha.png` | `ae3f5669-1883-412b-bd54-67a8d1a2fb4d`; local checker cleanup |

Detailed byte counts are in `docs/higgsfield-generated-assets.json`.

No provider tokens, signed upload URLs, or secrets are stored in the project.
