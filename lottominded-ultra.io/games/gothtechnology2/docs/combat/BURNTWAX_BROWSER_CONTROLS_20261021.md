# BurntWax-style browser controls — local integration

Date: 2026-10-21. Branch: `upgrade-redesign`. This is the browser adaptation explicitly selected by the user, not a Unity engine port. No production deployment was performed.

## Package inspected

- Official listing: https://assetstore.unity.com/packages/templates/systems/burntwax-fps-engine-352464
- Local archive: `C:/Users/digit/AppData/Roaming/Unity/Asset Store-5.x/Burntwax Collective/Complete ProjectsSystems/Burntwax FPS Engine.unitypackage`
- Archive size: 107,978,822 bytes.
- SHA-256: `94775317432747deff5e5fa4b447fad0d761ce1e2d2155f62a56e39d53313b55`.
- Inspected InputManager, InputPrioritySorter, camera FPS/aim states, BobAndSway, gun rest/aim/shoot/stow states, AimConfig and PlayerSprintState.
- Extracted only small source/configuration files into a local evidence directory. No Unity ProjectSettings were imported. No original Asset Store source, meshes, scenes or textures were added to the website or repository.

## Implemented behavior

- New default **BurntWax-style** on-foot control option in Settings → Combat camera; **Classic** remains selectable and persists alongside existing sensitivity and field-of-view preferences.
- A new sprint press lowers an existing held/toggled ADS request. A fresh aim press interrupts sprint. Firing interrupts sprint while the firing button is active. Releasing aim/fire lets an otherwise eligible held sprint resume.
- Simultaneous aim and sprint favor aiming. ADS and fire remain compatible in both press/release orders.
- Reload temporarily suppresses aiming, firing and sprint. The existing ADS request returns when authoritative reload ends.
- Raw movement/look coordinates never initiate firing. The helper receives explicit existing button states only; it does not add any event-to-fire path.
- Existing mounted controls, brawl, photography, holster/draw, server eligibility, damage, ammunition, collision and hitboxes remain authoritative and unchanged by this adaptation.
- Bounded, rate-normalized first-person weapon sway and gait bob; reduced-motion preference clears the added sway. ADS reduces added sway to 3%, with firing stabilized separately.
- Wheel speed no longer triggers the first-person on-foot running pose. First-person presentation resets on lifecycle/camera changes and large state discontinuities.
- Existing MSJ-style on-foot smoothing and all pre-existing uncommitted fixes were retained.

## Source changes in this task

- `swoop-source/src/detroit/royale/fpsControlFlow.ts` — priority helper and view-only sway.
- `swoop-source/src/detroit/royale/fpsControlFlow.test.ts` — eight behavioral regression cases.
- `swoop-source/src/detroit/royale/main.ts` — command integration and lifecycle reset.
- `swoop-source/src/detroit/royale/combatPolish.ts` — saved profile and accessible settings.
- `swoop-source/src/detroit/royale/fpsMotion.ts` — reset and on-foot-only run presentation.
- `swoop-source/src/detroit/royale/firstPersonView.ts` — view-only sway and clean camera/state transitions.

The existing source build regenerated the Swoop package entry HTML and assets under `store/public/arcade/swoop-detroit`. Generated bundles were not hand-edited. Royale's rebuilt entry is `royale-CAHAvZwA.js`.

## Verification

Evidence directory: `C:/Users/digit/Documents/phone/output/burntwax-controls-20261021/`.

- 31 targeted tests passed: new control flow plus aim comfort, camera preferences, action states and mouse combat input.
- 17 regression tests passed: all five heroes' FPS hands/holster presentation, authoritative holster, free on-foot heading and respawn recovery. The initial plain Node invocation failed on CSS imports; rerunning with the existing `node-css-loader.mjs` via `--import` passed.
- Type check passed: `node node_modules/typescript/bin/tsc -p tsconfig.merge-check.json --noEmit` from `swoop-source`.
- Existing `prepareSwoop().buildCode(...)` and package validation passed. Existing large-chunk warnings remain.
- `git diff --check` passed (line-ending warnings only).
- HTTP checks confirmed all three local game entry pages and their directly referenced scripts return 200 and byte-for-byte match the local built files. This task changes only Royale's combat behavior.
- In-app browser: menu opened; Classic selection survived reload; restored BurntWax-style; entered the shooting range, dismounted into first person, moved with keyboard, aimed and fired with on-screen controls, and reloaded from 18/60 to 20/58. ADS lowered during reload and returned afterward. No runtime errors were logged during that check.
- Temporary test changes to on-foot camera and touch-display preference were restored to the prior third-person/Automatic values. BurntWax-style remains selected as requested.
- Screenshots: `control-settings.png`, `range-ads.png`; logs: `tests.txt`, `regression-tests.txt`, `typecheck.txt`, `build.txt`, `served-files.json`.

## Limits and review

- Local URL: http://127.0.0.1:8261/arcade/swoop-detroit/royale.html?burntwaxReview=20261021
- No production push, Unity runtime replacement, new assets, network hosting changes or multiplayer/voice tests.
- The embedded browser does not provide pointer lock, so the browser check used its existing drag-to-aim fallback and on-screen ADS/Fire. True pointer-lock behavior was not physically retested in a normal browser in this task; button ordering and focus/capture resets are covered by the targeted tests.
- Physical iPad/Android feel, gyro input and sustained frame-time performance remain unverified. This change is not evidence of a 60 FPS fix.
