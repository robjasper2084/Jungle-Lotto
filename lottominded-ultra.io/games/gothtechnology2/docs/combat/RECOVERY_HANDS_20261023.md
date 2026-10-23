# Recovery and first-person hands — 2026-10-23

- All three games expose recovery independently of rider skin. Swoop's header control now includes unicycles. Elmwood's accessible control routes through the existing solo/online action and four local seats have contextual fall buttons. Royale exposes recovery without requiring touch controls, and Recover also requests the ordinary pickup/remount after knock-off. Normal stagger, proximity, health, collision and stock rules remain authoritative; recovery does not respawn an eliminated player.
- First-person clones use corrected palm directions and weapon-specific wrist spacing. Tapered sleeves stop behind the wrists, preserving the rig's real hand and finger geometry. World rigs, hitboxes and weapon muzzle calculations are unchanged.
- Higgsfield generated a tileable glove/sleeve material (job b6d560f9-606e-413a-9b5c-b4ef4a8c13b4). The runtime texture is a 91 KB WebP; provenance is beside it.
- Kimodo recovery source and provenance are in swoop-source/art/kimodo-recovery. The fitted get-up segment provides hip rise and hand support, while existing fall physics and recovery timing remain in control. The raw full generated fall is not played verbatim.
- Earlier completed Kimodo walk and wheel pickup changes are included in this release candidate.

Validation: Swoop and Elmwood TypeScript checks, RideCore build, and all three browser game entry builds pass. Thirty targeted recovery tests pass, including human remount for all five rider IDs through both authoritative paths, AI recovery, fall motion and race checkpoint recovery. Hand visibility/geometry, sleeve fitting and holster tests passed separately. Browser review covers first-person hands, recovery animation and recovery controls. Physical iPad stability and sustained 60 FPS are not established by this work.

Evidence: C:/Users/digit/Documents/phone/output/recovery-hands-20261023. Publication is tracked separately by the release receipt and live verification there.
