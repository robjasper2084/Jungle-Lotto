# Assets and animation audit — October 9, 2026

Scope: real Swoop source, separately packaged Elmwood source, and their shared Static Royale. No new map or unrelated replacement characters were introduced.

| Area | Current finding / action |
|---|---|
| Five heroes and EUC | Existing rigged models and identity textures retained; prior Blender/Unity six-model preflight remains separately recorded. |
| Walking | Installed Huge FBX Mocap Library part 2, `55_04.fbx`, 1.25-second baked anatomical motion is present in both sources. |
| Jogging / running | Installed Free Sample Animation Set, `A_JogFwd_Loop.fbx` and `A_RunFwd_Loop.fbx`, retained. |
| Door / pickup / reach | Installed Free Interaction Animation and Free Sample Animation Set channels are present; not replaced by unrelated generated motions. |
| Crash / recovery | Existing articulated runtime overlays retained; this pass does not claim a new full-body mocap replacement. |
| Royale weapons | Replaced one shared primitive placeholder with three distinct Higgsfield/Blender GLBs, finishes and recoil clips, following each actor's authoritative weapon kind. |
| Royale supplies | Replaced generic octahedra with distinct ammo/repair/shield models and seamless idle clips. Weapon drops use their actual weapon models. |
| Character selection | Fixed retained-model issue when restarting practice with a different rider; independent geometry instances and animation mixers. |
| Shield field / projectiles | Existing lightweight VFX geometry retained deliberately. They are functioning runtime effects, not missing external model files. |

Actual tools used: Higgsfield 3D Jutsu revision 2; local Blender 5.2.1 glTF/UV/NLA workflow; Unity 6000.3.24f1 with installed glTFast 6.20.0. Relevant installed tools were used; unrelated addons were not installed or activated. The local Blender MCP server was unavailable, so actual local Blender background authoring/export was used. No paid-generation endpoint or paid hosting was activated.

See [editable assets, provenance and checks](../../swoop-source/art/royale-equipment/README.md). The six exported clips passed Unity and actual-GLB runtime checks. Source and staging checks passed. Both game origin routes use the same equipment library while retaining their own return destinations.

This is a focused asset-gap pass, not certification that every scene or animation in both games is complete. Detailed limb/socket testing across every aim angle, every landmark and mode, physical 2015+ mobile devices, long online sessions and six-human acceptance remain in the existing acceptance matrix. User explicitly left the six-human test pending. Nothing was deployed.
