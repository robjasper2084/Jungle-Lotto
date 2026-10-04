import bpy,json
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[1]
pack=Path('C:/Users/digit/Documents/phone/Digital_Static_Street_Asset_Pack')
bpy.ops.wm.read_factory_settings(use_empty=True)
info=[]
for name,path in [('hero',pack/'exports/glb/DS_Man_01/DS_Man_01_LOD1.glb'),('wheel',pack/'exports/glb/DS_EUC_01/DS_EUC_01_LOD0.glb'),('dog',root/'public/exports/polish/DS_Boerboel_Polished.glb'),('towers',root/'public/exports/atwater/renaissance-center.glb')]:
 before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(path));new=set(bpy.data.objects)-before
 pts=[o.matrix_world@Vector(p) for o in new if o.type=='MESH' for p in o.bound_box]
 info.append(dict(name=name,bounds=[[min(p[i] for p in pts),max(p[i] for p in pts)]for i in range(3)],roots=[o.name for o in new if not o.parent],bones=[b.name for o in new if o.type=='ARMATURE' for b in o.pose.bones],actions=[a.name for a in bpy.data.actions]))
(root/'art').mkdir(exist_ok=True)
(root/'art/cinematic-asset-inspection.json').write_text(json.dumps(info,indent=2))
print('CINEMATIC_ASSET_INSPECTION_OK')
