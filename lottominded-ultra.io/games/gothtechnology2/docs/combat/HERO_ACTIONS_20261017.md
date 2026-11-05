# Hero actions — local build, 17 October 2026

Implemented in the working game sources and rebuilt all three local routes. Nothing in this update has been published to GitHub Pages.

## Player behavior

- Royale: press `3` or tap **Holster / Draw**. The right hand reaches the belt, lifts the weapon, and the support hand joins before the ready pose. Holstering reverses the motion and releases both arms into the shared idle/walk. First-person hands lower out of view while stowed.
- Firing or aiming with a stowed weapon starts the draw. The authoritative match rejects shooting/reload until the transition finishes. Repeated requests cannot skip it. State and animation ticks are included in guest snapshots and restored match state. Protocol 6 rejects older clients without the new command field.
- Swoop, Elmwood and Royale: return to the parked wheel and use **Get on wheel / J**. The supplied farm-harvest pickup drives the body; the right hand grips the actual carry handle before the wheel lifts, stays attached during set-down, then releases before remounting. Short mascots get proportionate lift and reach correction.
- All five heroes share a quiet standing idle with breathing, small weight shifts, relaxed hands and planted feet. The supplied forward walk and reversed backward walk are preserved.
- Fixed a camera switch found during walkthrough: on-foot state now synchronizes before command generation and camera toggling, without requiring a first aim drag.

## Authoring and exports

Used installed Blender 5.2 / Rigify. No paid plugin or new character download is required.

- Reproduce editable action masters: `scripts/author-hero-actions.py` with background Blender.
- Masters: `swoop-source/art/hero-actions-20261017/Action_Curves.blend` and five `DS_*_Actions.blend` files. Native deformation actions and matching editable Rigify controls are retained. Set the controls' `Edit_pose` to 1 for editing.
- Four clips per hero: StandingIdle, WeaponDraw, WeaponHolster, WheelPickupPolish. Gameplay samples compact Blender curves and retargets onto the existing heroes. Pickup retains the supplied capture plus runtime handle IK.
- Export script: `scripts/export-hero-actions-unity.py` writes 20 animation-only FBXs to `C:/Users/digit/Documents/phone/hero-wheel-animation-20261004/UnityProject/Assets/HeroActions20261017/Models`.
- Unity import/rig validation entry: `HeroActionPolish.Build` in that project's `Assets/Editor/HeroActionPolish.cs`, using the installed Animation Rigging package. **Not verified in Unity:** its Licensing Client repeatedly failed to connect; the isolated batch attempt was stopped. FBXs and the importer remain ready. No Unity license/settings were changed.

## Verification

- Shared-core, Swoop/Royale and Elmwood TypeScript checks passed.
- 19 focused action, pickup, walk, visibility and aiming checks passed; after the belt-height adjustment, 14 relevant checks were rerun and passed. Existing authoritative Royale engine tests passed (10 checks).
- All five rigs: finite transforms, natural limb lengths, planted idle feet, both ready grips reachable. Stowed grip is constrained to belt height. Maximum measured pickup handle error was 0.0074 m on the hoodie mascot; other rigs were effectively at the handle.
- Browser: Royale first-person holster/draw, belt stow, immediate on-foot camera switching, and pickup-to-remount observed. Swoop pickup/remount and Elmwood female standing/pickup/remount observed. No console errors were reported in those sessions. Screenshots are saved in `C:/Users/digit/Documents/phone/output/royale-weapon-drawn-20261017.png`, `swoop-wheel-pickup-20261017.png`, and `elmwood-standing-idle-20261017.png`.
- Physical iPad, new multiplayer-host deployment and two-human animation replication were not tested in this update.
- Local build receipt: `.game-builds/538b6c81-50af-4990-9dba-7eff8b473754/release.json`, built at 2026-10-17T22:38:47.832Z. Swoop and Royale share one package; Elmwood is the second package.

Local URLs use port 8261: `/arcade/swoop-detroit/index.html`, `/arcade/swoop-detroit/royale.html`, `/arcade/elmwood-explorer/elmwood.html`.
