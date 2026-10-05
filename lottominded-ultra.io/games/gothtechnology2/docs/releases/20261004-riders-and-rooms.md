# Swoop Detroit and Elmwood rider / multiplayer release

## Behavior

- Elmwood supports 2–4 local riders and up to four online riders. Room codes, invitation links, readiness, chosen heroes, chat, free riding, Creek Lane races, tricks, discovery rides, AI race fill, camera choices and validated host-authoritative RideCore frames use the existing live Realtime service.
- Elmwood rooms use a separate protocol so older Swoop clients cannot join an incompatible terrain simulation. The published Swoop SDK URL supplies the existing Realtime client; no database, authentication or billing contracts changed.
- Loading is a static progress screen. Ready-to-ride keeps compact controls, five EUC choices and armored default. Pedal and electric bikes are excluded from the ride selectors. Swoop LOVE TAG is in More.
- All five moving hero rigs preserve limb bend directions through riding and falls. New Blender/Unity dismount, wheel recovery and park-and-walk authoring files are delivered separately; these new clips are not wired into the browser state machines in this release.
- New supplied murals cover their full fitted walls, face the trail, retain readable UVs and use a rough concrete-grain paint finish. All underpass ceilings and beams retain their original concrete; wall artwork remains intact.
- Swoop and Elmwood startup/loading artwork uses new Higgsfield images with the two supplied circuit-face mascots, the suited man and the woman riding electric unicycles. The robot is removed from artwork only; its playable choice remains. Compressed, versioned WebP files keep the menu pictures lightweight and avoid stale artwork.
- Wheel rear lights flash while riding, show a steady brighter red on braking, and respect reduced motion. Front lamp materials and the local player's headlight work in both maps.
- Digital static (1), track-13, is removed from both soundtrack catalogs and excluded from Swoop packaging, including the audio file.

## Verification

- Both source TypeScript checks and both packaging builds passed.
- Sixteen Elmwood multiplayer/session tests passed: independent controls, controller assignment and disconnects, pause/rearm, recovery, terrain, checkpoints, trick events and room/frame validation.
- Five mural / wheel-light tests and fifteen actual-GLB riding/fall pose checks passed. Sixteen root Pages tests passed.
- Two browser clients connected through the real Realtime service, launched a shared ride with different heroes, synchronized independent guest motion and recovered after a collision. The invitation path subsequently prepared riders without reopening the menu.
- Local four-player split screen rendered four chosen heroes; third-player cruise changed its position independently. Pause/resume worked. An online host launched a four-rider race with three AI pilots; rivals advanced through Creek Lane gates. Leaving returned to the room panel.
- No physical gamepad, phone, headset, four-human online session or extended network soak is claimed as tested.

## Frame-rate limits

Current desktop samples do **not** establish consistent frame rates across all maps. On an RTX 3080 at manual Ultra, 20-second visible samples measured Detroit riverfront 30.5–46.2 FPS, Eastern Market 27.5–47.2 FPS and Mack approach 10.2–33 FPS, while Elmwood entrance measured 55–60 FPS. Viewport dimensions differed during these samples; the Mack sample includes loading. A subsequent four-view Elmwood Ultra observation fell to 14.5 FPS. Use Automatic or Smooth for lighter devices; these observations are not controlled mobile or whole-route benchmarks. Raw evidence is in `evidence/20261004-frame-rates.json` and multiplayer evidence alongside it.
