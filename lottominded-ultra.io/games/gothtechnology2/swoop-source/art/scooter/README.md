# Detroit T-shirt scooter riders

Created for Swoop Detroit on 2026-09-23.

- `SW_Scooter_01.blend`: editable green/white electric scooter, modelled in Blender from the supplied `1.webp` reference. Separate wheel pivots, rubber deck, grips, brake levers, cable, lights, fenders and alloy frame. The geometry is an interpretation, not a manufacturer CAD model.
- `SW_Detroit_Tee_Rider.blend`: existing supplied cyclist identity and humanoid skeleton, adapted to a short-sleeve Detroit T-shirt and bare forearms. Helmet, pants, shoes and gloves retained. Garment edges are cut into the mesh rather than painted across whole triangles.
- Matching FBX files are supplied for Unity import. Scale is metres; no Unity-only runtime dependency is introduced. Unity Editor import and hardware VR testing were not performed in this task.
- Browser GLB files are in `../../public/exports/scooter/`. Character textures are capped at 1024 pixels and compressed in the GLB; scooter static pieces are joined by material while the wheel pivots remain separate.
- Higgsfield generated the cotton/embroidery base color from the user's supplied shirt photograph. Model `gpt_image_2_5`, job `84262af9-fbc6-4bca-b48b-560d3cb50a5e`. The generated PNG is retained beside the browser assets. No further generated skin purchases are required to use this asset.

## Rebuild

Run Blender in a separate background process:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --python tools/build-scooter-assets.py
node ../scripts/build-swoop-detroit.mjs
```

Run from the `swoop-source` directory. The generator reads the supplied Digital Static asset pack but writes only this project's scooter assets and editable sources.

## Runtime

`MobilityRider('scooter')` drives the existing skeleton with two-bone IK. Both feet stay in a staggered deck stance; hands follow handlebar targets; wheel roll is driven by travelled distance. Small knee/hip movement follows travel speed. The model does not contain independently articulated finger bones.

`world.ts` mixes scooter riders into the 62-person traffic roster, travelling at 4.2 m/s before avoidance/yielding. Crowd passing, solid envelopes, impact knockdown, separate equipment fall and recovery are shared with the other trail users.

Open `traffic-studio.html`, select **Scooter riders**, then use Front/Side view, Pause, or Impact / recover to inspect the result. These are ambient traffic riders, not additional selectable player vehicles.

FBX files contain the rig and rest pose; runtime procedural riding/fall animation is implemented in TypeScript, not baked into FBX clips. For a Unity port, import as a Generic rig or map the humanoid bones, then implement the runtime IK/fall controller in the target engine.
