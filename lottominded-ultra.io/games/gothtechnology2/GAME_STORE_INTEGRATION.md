# Game and store integration

The fighting engine, roster, controls, stage assets, audio and original entry remain unchanged. The store's play route adds a shell and launches the preserved entry only after an explicit action. Game code and audio are not loaded by the homepage.

preserved-original-entry/index.html is the backup under legacy-game/. SHA-256 of both original entries: 6766FA401D40B22E57C70CF9A291D508D3D37C74BD03E0FA294F453690BF168D.

The build/dev adapter injects a base URL, the existing SDK path and store/public/legacy-game/bridge.js into the served copy. It does not patch the original engine. Valid character query IDs: MASTER_EZRA, KALYX, DETROIT_LENS_NOIR, AMARA_VALENTINE.

The parent accepts only messages from the actual iframe contentWindow with its own origin and an exact approved schema: GOTHTECH_GAME_READY, GOTHTECH_CHARACTER_SELECTED, GOTHTECH_MATCH_COMPLETED, GOTHTECH_OPEN_COLLECTION. Unknown IDs, collections, keys, durations and origins are rejected. These checks prevent accidental or cross-origin messages; same-origin client code is not trusted to authorize money.

The bridge observes existing game state events. After an eligible locally observed match, the parent may display a local cosmetic signal badge. No account, credits, coupons, discount, payment, collectible ownership or server-verified reward is issued. The RewardService monetary interface deliberately fails closed until an independently authorized server service exists.

The standalone legacy entry remains available for debugging. Existing keyboard, touch, mobile orientation and gameplay tests remain in tests/browser and tests/gameplay.test.js.
