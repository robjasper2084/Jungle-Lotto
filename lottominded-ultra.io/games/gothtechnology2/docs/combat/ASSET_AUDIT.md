# Installed animation and equipment audit

The pinned BreadFlowerDos source has no reusable rider mocap library. Its PlayerInput implementation is integrated without alteration. EventManager and GameServer are incomplete upstream; original bounded combat/rules code is explicitly attributed separately.

The already installed cMonkeys Huge FBX Mocap Library part 2 contains 79_96.fbx and 80_03.fbx. Both were extracted locally and imported in Blender 5.2.1 into saved inspection scenes. They contain 44-bone full-body gun mime, 112 and 132 frames at 24 fps. They are reference candidates, not a verified mounted reload. Existing READTHIS licensing permits use, but raw packs/FBX are not shipped in this release. Free Interaction and Free Sample packages did not provide a verified mounted reload state.

The six existing Higgsfield equipment assets (static, heart, bass, ammo, repair, shield) were optimized/authored in Blender, validated by the Unity 6000.3.24f1 import checks and already integrated into the actual shared browser arena. Existing walking/running/jogging/interaction mocap is retained. Missing mounted upper-body states use the documented original fitted IK fallback; no locomotion clip replaces EUC pedal poses. No new paid generation, asset purchase or software installation was used for this pass.

Private candidate hashes: 79_96 e5790953bac41cac0ded94badb37cfd72a1fe1d1030dda8d156c51ea083fc7fc; 80_03 9965a7f82c5a5bec35d81ce49aeda831599325a6a623715c21d81eb375914198.
