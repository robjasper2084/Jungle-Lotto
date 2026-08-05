# Asset Manifest

Stable keys keep art replaceable without gameplay edits.

| Key | Current asset | Intended replacement |
|---|---|---|
| `brand.icon` | `assets/icons/icon.svg` | 512px Guardian number-sphere icon |
| `arcade.keyArt` | `assets/art/fortune-grid-arcade-key-art.png` | Generated 16:9 Detroit board artwork |
| `board.detroit` | `assets/art/detroit-fortune-grid-board.png` | Official-GIS-referenced Detroit silhouette, riverfront, sports district, Belle Isle, both international bridges, and landmark cues |
| `board.vault` | `assets/art/guardian-vault.png` | Generated transparent Guardian Vault sprite |
| `district.*.gateway` | `assets/art/gateways/gateway-01.png` through `gateway-08.png` | Eight generated transparent gateway sprites |
| `token.mascot` | `assets/art/mascot/01.png` through `06.png` | Six-frame strip derived from the user-supplied LottoMind mascot turnaround |
| `token.*` | `assets/art/tokens/token-01.png` through `token-06.png` | Six generated transparent token concepts |
| `venture.level.*` | `assets/art/ventures/venture-level-1.png` through `venture-level-4.png` | Four generated development levels |
| `card.pulse.*` | `assets/art/city-pulse-card-atlas.png` | 24 generated Detroit City Pulse illustrations |
| `card.oracle.*` | `assets/art/dream-oracle-card-atlas.png` | 24 generated Dream Oracle illustrations |
| `audio.*` | None shipped | Original loops/SFX after rights review |

Runtime artwork was generated with ChatGPT's image-generation tool. The board composition was guided by City of Detroit GIS outlines and named public landmarks; generated architecture is stylized and is not a survey map. Street geometry, stop labels, and procedural landmark forms are rendered separately by Three.js and the semantic HUD for clarity. No city seals, team marks, casino trade dress, or copyrighted recordings are included.

`scripts/process-art.py` reproducibly crops the generated transparent board-pieces atlas. The mascot chroma source is normalized into six shared-scale, bottom-centered frames under `assets/art/mascot/`.
