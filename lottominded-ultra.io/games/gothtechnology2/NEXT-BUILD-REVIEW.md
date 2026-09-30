# Swoop Detroit next-build review - 2026-09-26

Branch: next-build/finished-pass-20260925. Base: 07612311. Local only; no merge or deployment.

## Implemented
- Practice retains the speed prerequisite when advancing into braking. Crashes, recovery and discontinuous movement invalidate airborne attempts; only a fresh clean/charged landing can complete the hop lesson.
- First-time Practice recommendation; defensive completion persistence; replay, skip/free ride and End-to-End Dash actions; device-specific instructions.
- Shared move eligibility used by the simulation and HUD, including clearance, speed, grounded state, lean and cooldown. No new physics thresholds. Interrupted settle text now says not validated rather than not banked.
- Keyboard shortcuts no longer steal Enter/Space from focused buttons and links. This conflict was reproduced in the browser.
- Packaged audio preserves saved Sound off. Browser toggle/reload verified Sound off.
- Asset preflight precedes output creation. Packaging uses a staging directory and retains the previous complete package for rollback. Missing-pack test failed safely with the existing index hash unchanged.
- Failed record storage now retains its session-only warning instead of immediately overwriting it.
- User-requested first-person motion follows real rider lean, compression and extension, with bounded pitch/roll. Existing animated head position retained. Reduced-motion attenuates added motion; VR branch unchanged.

## Changed source
swoop-source/package.json
swoop-source/src/detroit/practiceCoach.ts and practiceCoach.test.ts
swoop-source/src/detroit/specialMoves.ts and moveReadiness.test.ts
swoop-source/src/detroit/controller.ts
swoop-source/src/detroit/main.ts
swoop-source/src/detroit/districtView.ts
swoop-source/src/detroit/firstPersonMotion.ts and firstPersonMotion.test.ts
scripts/build-swoop-detroit.mjs
.gitignore
Generated store/public/arcade/swoop-detroit package rebuilt from source.

## Verification
- TypeScript check passed.
- Full suite: 374 tests passed, zero failures. Includes actual-controller mapped-route completion, ordered gates, recovery, scoring, replay/ghost, actor and companion regression coverage.
- Source build passed using npm run build -- --configLoader native. Default Vite config bundling hit a Windows sandbox ancestor-directory access error; native loading avoids that error. Large-chunk warning remains.
- Real store packaging passed after preflight, 54 external selected assets plus source and audio directories.
- Browser: local nested-path boot, Practice entry and instructions, Ready feedback, Sound off persistence, no captured console errors.
- Baseline and revised preview screenshots were inspected inline; no saved matched-position recording set was produced.
- Current local runtime sample: Windows Codex browser, RTX 3080 / ANGLE D3D11, 480-frame window, frame p50 6.9 ms and p95 7.1 ms; startup 10275 ms; 896 geometries, 108 textures, 39 programs. This is one runtime sample, not a device-wide FPS guarantee or a benchmark of camera changes.

## Remaining QA / limits
No physical Android, iPhone, gamepad or VR hardware test this pass. Full human-operated route completion, matched before/after recordings, multitouch combinations, context-loss restoration, repeated-run memory plateau, and subjective moving first-person approval remain unverified. Existing automated route tests do not replace those checks. No additional scenery/physics tuning was justified by the measured sample. Referenced upgrade-kit patch files were absent; their stated practice/audio intent was implemented directly. No generated artwork or paid calls.

## Rollback
Original packaged output retained in .swoop-builds/ddefb66a-465f-46c2-a69e-115592ff0dec/previous. Later build backups contain intermediate review builds. To roll back, stop the local server, rename current package to a separate review backup, then restore the chosen previous folder to store/public/arcade/swoop-detroit. Preserve unrelated untracked work. Source changes remain uncommitted on the review branch for selective review.

Preview: http://127.0.0.1:8210/arcade/swoop-detroit/
