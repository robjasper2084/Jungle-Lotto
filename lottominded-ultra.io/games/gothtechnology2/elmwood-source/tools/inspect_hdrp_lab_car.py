import bpy, json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/'art/elmwood/hdrp-lab-car'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=str(ART/'source/Assets/HDRPLab/Scenes/HDRPLabController/Models/LabCoupe_MD.fbx'), use_anim=False)
bpy.context.view_layer.update()
rows=[]
for o in bpy.context.scene.objects:
    if o.type!='MESH':continue
    rows.append(dict(name=o.name,triangles=sum(len(p.vertices)-2 for p in o.data.polygons),
                     dimensions=list(o.dimensions),location=list(o.matrix_world.translation),
                     materials=[m.name if m else None for m in o.data.materials]))
(ART/'mesh-inventory.json').write_text(json.dumps(rows,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(ART/'source-import.blend'))
print('MESH_INVENTORY',len(rows),sum(r['triangles'] for r in rows))
