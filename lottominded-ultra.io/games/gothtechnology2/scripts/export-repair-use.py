"""Export the authored Higgsfield repair activation for the handheld game prop.

Run in a separate Blender process. The hosted source and pickup models stay intact.
"""
import bpy, json
from pathlib import Path
PACK = Path(__file__).resolve().parents[1]
ART = PACK / "swoop-source/art/royale-repair-20261018"
bpy.ops.wm.open_mainfile(filepath=str(ART / "Higgsfield_Equipment_Revision3.blend"))
root = bpy.data.objects["PRP_repair"]
lid = bpy.data.objects["repair_lid"]
action = bpy.data.actions["Use_repair"]
slot = lid.animation_data.action_slot
objects = [root, *root.children_recursive]
for obj in objects:
    obj.animation_data_clear()
root.location = (0, 0, 0)
lid.rotation_euler = (0, 0, 0)
lid.animation_data_create()
track = lid.animation_data.nla_tracks.new()
track.name = "Use_repair"
strip = track.strips.new("Use_repair", 1, action)
strip.action_slot = slot
strip.extrapolation = "HOLD"
scene = bpy.context.scene
scene.frame_start = 1
scene.frame_end = 91
scene.render.fps = 30
scene.frame_set(1)
bpy.context.view_layer.update()
bpy.ops.object.select_all(action="DESELECT")
for obj in objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = root
out = PACK / "swoop-source/public/exports/polish/royale-equipment/repair-use.glb"
bpy.ops.export_scene.gltf(filepath=str(out), export_format="GLB",
    use_selection=True, export_animations=True, export_animation_mode="NLA_TRACKS",
    export_force_sampling=True, export_frame_range=True, export_cameras=False,
    export_lights=False, export_yup=True)
# Keep an editable local copy of exactly the exported hierarchy.
bpy.ops.wm.save_as_mainfile(filepath=str(ART / "Repair_Use_Game.blend"))
(ART / "provenance.json").write_text(json.dumps({
    "higgsfieldProject":"eb66baf3-02f8-4fb3-a901-fce871398078",
    "revision":3,"action":"Use_repair","fps":30,"duration":3,
    "source":"Existing GothTech equipment and motion; original materials preserved",
    "export":str(out),"bytes":out.stat().st_size
}, indent=2))
print("REPAIR_USE_EXPORTED", out.stat().st_size)
