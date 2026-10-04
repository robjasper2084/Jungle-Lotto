# Release validation — 15 September 2026

| Check | Result |
| --- | --- |
| RideCore TypeScript build | Passed; compiled ESM and declarations in dist |
| RideCore tests (`npm test`) | 86 passed, 0 failed |
| Standalone headless demo (`npm run demo`) | Rolling pirouette completes, 240 points, mascot stopFoot = 0 |
| Three.js integration example typecheck | Passed with strict NodeNext resolution |
| Actual rider rigs compared against source Hero | Four characters, 34 poses each; maximum sampled bone-position difference 0 metres |
| Source Detroit/Elmwood game tests | 202 passed, 0 failed |
| Source game TypeScript check and Vite build | Passed |
| Installed Elmwood game browser check | Started normally; no console errors; sound enabled, AudioContext running |
| Live warning preview | Warning level about 0.417, peak sampled beep gain about 0.0343, running AudioContext |
| Live pedal scrape preview | Scrape intensity about 0.719, scrape gain about 0.0790, running AudioContext |
| Pause and mute | Master gain becomes zero; mute preference survives reload; Sound on restored after testing |
| VR capability UI | Reports no immersive headset available in the desktop test browser; flat play remains functional |
| Isolated npm archive installation | Passed; root, input, audio, touch and companion import without Detroit, DOM or Three.js; pirouette awards 240 points |

Controller tests use representative standard gamepad, Quest and Vive wand input records. They verify axes/dead zones, trigger braking, release-to-hop, trick selection, snap-turn hysteresis, disconnect reset, speed limiting and recenter math. They are not physical controller/headset playtests. Quest/Vive performance, comfort, display alignment and physical button/audio behavior remain to be validated on hardware. No native engine build or public HTTPS deployment was made.

Full portable test output: `validation-tests.txt`. Rig comparison details: `rig-validation.json`. The rig check reads the existing project's real GLB skeletons/geometry and omits texture decoding only; it does not modify the asset files.
