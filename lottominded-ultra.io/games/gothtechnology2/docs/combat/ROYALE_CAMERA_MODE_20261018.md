# Royale camera mode and shoulder draw — local review

Status: implemented and rebuilt locally on 2026-10-18. No deployment or multiplayer-host restart was performed.

## Player controls

- Camera mode / Combat mode switches the weapon into photo/video use. Keyboard P toggles it; O starts/stops a clip. Bindings remain remappable.
- Photo or the Fire control takes a JPEG without the HUD. Movement and optics still work; offensive inputs are suppressed.
- Record captures up to 60 seconds, 1280×720 at 24 fps, capped at 24 MiB. It records game effects/music, without microphone or voice chat.
- Review previews the latest result. Save downloads it. Share opens supported device sharing; unsupported browsers explain how to save and upload through a social app. Posting is always a player action.
- Only the latest result is retained. Save/share it before replacing it with another photo or clip.

## Shoulder handling

The old direct back-to-ready interpolation was replaced with a reversible 64-tick (1.067 s) shoulder draw. Blender-authored curves sequence reach, grip, lift, swing, supporting hand, torso turn and settle. The camera stays on its back mount until grip contact, lifts outside the dominant shoulder, then travels forward. Once gripped, the solved palm drives its position. The support hand joins after clearance. The same motion reverses for holstering. Existing walking/stance animation remains on the lower body.

Editable Blender source: `swoop-source/art/movie-cameras-20261018/Camera_Shoulder_Draw.blend`. Rebuild curves with `scripts/author-camera-draw.py`; the compact generated data is in `ride-core/src/royale/cameraDrawData.ts`. No additional character downloads are required.

The three movie-camera models were authored through Higgsfield project `eb66baf3-02f8-4fb3-a901-fce871398078`, revision 4. Source and provenance are under `swoop-source/art/movie-cameras-20261018/`. ADS sight positions clear the camera housings.

## Related completed local changes

- Three-round series with cumulative wins/kills/damage and host-controlled continuation.
- Ten active minutes from deployment completion until the barrier fully closes; earlier last-survivor victories remain possible.
- Translucent blue terrain-following forcefield, 384 triangles, no additional terrain sampling pass.
- Authoritative spectator selection with a three-second delayed view and restricted visibility; eliminated players eligible for re-entry cannot scout.
- Bounded scenery-impact mark pool, independent of actor-hit effects.

## Verification

- Initial focused regression suite: 29 tests passed (field schedule/C++ parity, series/spectator privacy, impact authority, camera input/codec selection and presentation).
- Shoulder update: seven focused tests passed, including authoritative holster gating and actual bone/weapon transforms for all five heroes in both directions, on foot and mounted. Stowed weapons were also checked through crouch/prone for all three models. First-person healing remains covered.
- Local core and client TypeScript checks passed. Server TypeScript checked against this checkout's rebuilt core. All three game routes rebuilt successfully.
- Browser: photo encoded and previewed; MP4 recording played to its 59.98-second limit at 1280×666 for the tested viewport, with readyState 4 and no playback error. Camera mode changes Fire to Photo. Shoulder reach/back mount visually inspected in the actual range. Round 1 → 2 continuation and clear ADS sightline were observed in the actual game.
- Evidence/logs: `C:/Users/digit/Documents/phone/output/royale-back-field-20261018/`.

## Remaining verification boundaries

- Native sharing, capture performance and download behavior require an iPad/phone retest. No social post was sent.
- The new spectator path has automated authority/privacy coverage; a new real-player session with the updated server has not been run.
- Animation preference/visual approval remains with the user. Technical hand-contact tests do not substitute for that approval.
- These changes are local. Old online hosts do not include the new rules/runtime identity until deployed/restarted together with the clients.
