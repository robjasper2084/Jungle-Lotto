# Combined game release — October 17, 2026

The canonical `swoop-source`, `elmwood-source` and `ride-core` trees now include the reviewed changes from `swoop-fps-release`, `elmwood-missed-release` and `ride-core-fps-release`. They retain the cinematic startup/loading screens and Royale aim-comfort work from production revision `d3731347`. Original review folders were not overwritten.

## Combined behavior

- Swoop and Elmwood retain their themed cinematic screens, real initialization progress and keyboard-accessible start actions.
- All three games receive bounded interior lighting, visibility/memory work, the supplied walk and pickup animations, and smaller Smooth-mode hero textures. The original model geometry, rig and animation data are preserved.
- Swoop includes the remote-player chase-camera correction and shared-link guidance. Shared voice includes speaker-toggle and ended-track recovery fixes.
- Royale combines camera-centered aim and configurable FPP/TPP camera settings with pointer-lock fallback, aim presets, independent axes, optional visible-target slowdown, customizable reticle and simple touch controls.
- The range retains the five-step lesson while adding confirmed target offsets, hit sound and bounded shared impact geometry. Reload remains in place and disables when unavailable.

## Validation

- Shared core compilation and both application type checks passed against the merged core.
- 108 focused game regression tests and two mobile-asset packaging tests passed. Coverage includes combat, aim comfort, camera following, animation fitting, lazy rider creation, texture lifetime, lighting, physics-query budgets, native/fallback gzip and voice lifecycle.
- 28 Pages assembly tests passed. Both release packages compiled and validated, covering Swoop, Royale and standalone Elmwood.
- Local Royale browser test completed the five-step lesson with confirmed 25 m hits, movement and reload; both camera and aim-comfort settings are present.

The initial broad legacy core sweep was not green: it also includes missing external cycling/server fixtures, outdated fixture mocks and an obsolete six-slot-only assertion. The review-only import paths in animation/startup tests were corrected to canonical paths and their focused tests passed. This release does not claim the entire historical suite passes.

Physical iPad crash/stutter acceptance, sustained riding frame rates, physical controller feel and a fresh cross-network audible-voice test remain unverified in this merge. No microphone was used, no TURN service was configured and no temporary public preview lease was renewed.
