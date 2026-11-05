# Static Royale audit — 18 October 2026

Status: local source and local built games updated. This audit has not been published. The previously verified public release remains `461b6695facb5ea5756bf6dde287043eec3ff2da`.

## Fixed and verified

- **Blank helmet artwork and backpack charms.** The geometry was present, but `OpponentContrast` cloned materials before their asynchronous texture loads completed. Material copies now synchronize when the original material version changes, including while contrast stays disabled for the local rider. Disposal restores the original materials. Stable frames do not recompile materials. A desktop browser check confirmed the Ghoulies helmet artwork and hanging charm are visible again.
- **Helmet selection in Royale.** Settings now includes the existing Ghoulies / plain-black picker. Both selections were exercised and Ghoulies was restored. This uses the established shared preference and artwork.
- **Healing prop and animation.** Replaced the temporary handheld cube with the existing GothTech health-pack design. Higgsfield project `eb66baf3-02f8-4fb3-a901-fce871398078`, revision 3, contains a new `Use_repair` lid animation. Blender 5.2.1 exported a separate 15,816-byte GLB and an editable local blend file. Original pickup assets and materials are preserved. Healing samples the clip from the simulation clock and supports reduced motion. The first-person attachment was corrected so the case sits above the palm rather than disappearing inside the sleeve; the medical marking faces the wearer.
- **Five hero rigs.** Automated checks cover stowed weapons through crouch/prone and first-person healing visibility/framing for the suited man, woman, both mascots and armored rider. This is technical coverage, not a claim that every animation has received new artistic approval.

## Validation

- `output/royale-audit-tests-20261018.log`: 32 passing checks in the broader audit. The separate downtown respawn test file failed to initialize because `love-tag-server/dist/hostFixture.js` and its fixtures are absent from this checkout. No respawn pass is claimed from that run.
- `output/royale-audit-final-tests-20261018.log`: 25/25 focused checks passed. Includes authoritative mounted combat, ten-player roster/projectiles, dog power and cover rules, scopes, actual-killer replay data, all-five-hero holster/healing checks and accessory loading regressions. These overlap some earlier checks; the counts should not be added.
- TypeScript merge check passed.
- Both game packages built successfully, including Swoop Detroit, Static Royale and Elmwood entry points. Build log: `output/royale-audit-build-20261018.log`.
- Local desktop browser: startup, shooting range, riding/on-foot and first-/third-person transitions, helmet picker, healing presentation. No captured browser console errors at the final settings check.
- Evidence: `output/royale-audit-20261018/accessories-restored.png`, `heal-third-person.png`, `heal-first-person.png` in the parent phone workspace.

## Still open / limits

1. **Shooting range time limit:** the local range inherits a final zero-radius field. A long practice session therefore ends in elimination. Reproduced in the browser; `ride-core/src/royale/practiceRange.ts` configures `[2000,1900,1800,1700,1600,0]`. It should receive an explicit noncompetitive training rule rather than altering online match rules.
2. **Downtown respawn integration QA:** restore/build the missing test fixture dependency before rerunning `royale-reentry.test.ts`. Other compiled authority tests passed; this missing dependency is not evidence that respawn gameplay is broken.
3. **Sustained 60 FPS and iPad reliability:** not established by these desktop equipment checks. The user's iPad still needs a sustained busy-route retest with loading, memory/reloads and frame pacing measured.
4. **Voice — user verified:** the user confirmed "The voice works verification" on 18 October 2026. Audible voice is therefore marked working based on the user's test. No microphone or hosting configuration was changed during this audit. Mute behavior and additional network/device combinations were not separately confirmed in that message.
5. **Unity import:** the new prop was exported and tested in Blender/Three.js. It was not validated in Unity; the earlier Unity licensing-client blocker remains separate.

Older audit statements that killer-perspective replay or all first-person hands are entirely missing are stale: those systems exist now. The compiled killcam tests confirm the actual attacker and historical shots, and reject an invented killer for field deaths. This does not substitute for an end-to-end live multiplayer killcam review.

## Free authoring tools that fit this project

The Unity project at `hero-wheel-animation-20261004/UnityProject` already lists Animation Rigging 1.4.1 and Cinemachine 3.1.7.

- **Animation Rigging:** first choice for hand/weapon contacts, foot placement and accessory constraints. https://docs.unity3d.com/Packages/com.unity.animation.rigging@1.4/manual/index.html
- **Cinemachine:** follow cameras, damping and camera transitions in a Unity runtime. https://docs.unity3d.com/Packages/com.unity.cinemachine@3.1/manual/index.html
- **Memory Profiler:** investigate memory retained in the Unity project. https://docs.unity3d.com/Packages/com.unity.memoryprofiler@1.1/manual/index.html

The shipped browser games use Three.js. Unity runtime plugins do not run inside them; useful authored animation must be baked/exported and integrated, and browser performance must be profiled in the browser. No third-party plugin was installed during this audit.
