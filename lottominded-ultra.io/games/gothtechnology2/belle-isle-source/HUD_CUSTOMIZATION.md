# Belle Isle — customizable HUD / split touch

Feature baseline: `cc1d37f43dbfb145e1bc6047fc40c1938e996f5e`.
This feature belongs on its own branch/PR. It is not an amendment or redeployment of PR148.

## Use
Start a ride, then Tools → Settings → Customize HUD. Local co-op also has a HUD layout button in its existing session toolbar. Choose one of three custom profiles, select a control, drag its inert preview handle or use the position/size/opacity fields. Save applies a valid draft; Cancel/Escape preserves the previous profile and the previous pause state. Undo/redo is bounded. Reset this view and Reset profile do not reset game progress.

Two-thumb, Left-handed and Compact presets operate on the currently available controls. Left-handed mirrors touch assignments, not steering/physics signs. The center guard can be adjusted from zero to 24% (default 8%). The guard rejects new background contacts only. Existing captured movement/look contacts keep their owners across the center and across co-op view boundaries. Ignored contacts remain ignored until release. Opposing co-op lift contacts use first-owner-wins because the existing co-op lift adapter is scalar.

Foot, EUC and hoverbike contexts are independent. Portrait/landscape and each 2–4-player split/seat have their own contexts. Open the editor in that game state to edit its available controls; it does not invent disabled or hidden game actions. Physical 3D cockpit instruments are not relocated by this screen-space DOM editor.

Profiles are saved under `belle-hud-layouts-v1` only on explicit Save. Legacy joystick, size, opacity, sensitivity and spacing remain the built-in starting arrangement. Race records, albums, loadouts and existing preferences are not rewritten. When storage is denied, validated changes remain usable for the visit and an explicit notice requests JSON export.

JSON import/export is local. Imports are limited to 128 KiB, three known profile identities, known mode/control identifiers and bounded finite data. Prototype keys, unknown fields, CSS, selectors and URLs cannot create behavior. An import edits a draft, not the active game. A read that finishes after a cancelled/replaced editor session is discarded.

## Integration
- `hudLayoutModel.ts`: versioned schema, allowed contexts, placement math, bounds/overlap checks, presets and history.
- `hudLayoutStore.ts`: migration reads, validated persistence and storage-denial reporting.
- `touchZones.ts`: start-region classification and independent ownership/generations.
- `hudLayoutRuntime.ts`: adapter to existing DOM controls and input lifecycle. No substitute renderer, physics loop or fabricated game state.
- `hudLayoutEditor.ts/.css`: native modal with inert preview handles, keyboard editing and permanent Save/Cancel controls.
- `mobileHud.ts`: installs the adapter, neutralizes ownership through its existing clear path, reports foot mode and caches joystick radius per gesture.

Actual existing controls retain their IDs and handlers. Safe-area/viewport dimensions are remeasured on layout changes, not every touch move. The custom placement range accounts for the whole hit rectangle. Interactive targets must remain at least 44×44 CSS pixels, in bounds and nonoverlapping before Save. Essential available controls cannot be hidden. A saved arrangement that does not fit a later viewport falls back to built-in controls without overwriting the saved profile. The fixed editor toolbar remains outside the customizable region.

The original 109 test-file inputs and all seven ESM bundle entrypoints remain intact. `hudCustomization.test.ts` is appended as the 110th input; no prior assertion, timeout, test, release workflow or 1024 MiB cap was removed or weakened. The previously identified polish `ERR_ABORTED` defect is not hidden or fixed by this HUD feature.

## Executed locally
- Focused strict TypeScript for the new modules and the actual `mobileHud.ts`/`mobileInput.ts` integration.
- 54 pure regression tests: schema, unsafe imports, storage failures, geometry, 44px minimum, presets, history, ownership, independent releases and center guard.
- Native Chromium UI fixture at 320×568, 390×844, 390×340, 844×390 and 1355×721: simultaneous move/look/brake, individual release, crossing center, rejected center contact, Save/Cancel, undo/redo, essential-control protection and pause restoration.
- Additional native UI fixture: drag without game actions, mirrored preset, separate profile names/layouts, unsafe and valid import/export, rotation cancellation and storage denial.

**Local fixture limitations:** the browser fixture uses the actual new HUD modules and original mobile input/HUD code, but mocked game hooks and Storage. It is not a screenshot or playthrough of the full Belle Isle world. Local browser policy blocked localhost navigation; the fixture was loaded from self-contained HTML, not by bypassing that restriction. The full game workspace, locked dependencies, source assets and genuine WebGL runtime were not available locally.

## Real-game acceptance / release status
New `belle-hud-layout.yml` is additive and PR-only. It builds the real checked-out game with the complete suite, then runs `hud-layout-browser-smoke.mjs` for desktop and phone. The smoke exercises actual UI startup, editor cancel/save/persistence, native touch, on-foot and hover discovery, co-op per-player profiles, small/oriented editor views and exact-source screenshots. It never seeds player, scene, race or storage state. Every request failure (including aborted and cleanup requests), HTTP failure, page error and cleanup failure stays fatal in the final report.

All original release gates remain necessary. Fresh full-game CI and manually inspected screenshots are pending until their artifacts exist. In particular, do not infer complete 3/4-player layout coverage, photo/WebXR compatibility, full racing endurance or physical-phone FPS from the local fixture. A draft PR is not merged or live. Production publication requires separate explicit release authorization and successful original safeguards.
