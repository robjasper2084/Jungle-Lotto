import bpy,json,sys
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[1]
source=root.parents[2]/'.game-builds/jazz-world-20261011/store/public/arcade/swoop-detroit/exports/glb'
out=root/'docs/combat/evidence/finger-rig';out.mkdir(parents=True,exist_ok=True)
rows=[]
for name in ['DS_Man_01','DS_Hoodie_Woman_01','DS_Mascot_Suit_01','DS_Mascot_Hoodie_01','DS_Armored_Rider_01']:
 bpy.ops.wm.read_factory_settings(use_empty=True)
 path=source/name/(name+'_LOD'+('0' if name=='DS_Man_01' else '1')+'.glb')
 bpy.ops.import_scene.gltf(filepath=str(path))
 arm=next(o for o in bpy.data.objects if o.type=='ARMATURE')
 hands=[]
 for side in ['Left','Right']:
  bone=arm.data.bones[side+'Hand'];parts=[]
  for o in bpy.data.objects:
   if o.type!='MESH':continue
   group=o.vertex_groups.get(bone.name)
   if not group:continue
   vertices=[v for v in o.data.vertices if any(g.group==group.index and g.weight>.2 for g in v.groups)]
   if not vertices:continue
   coords=[arm.matrix_world.inverted()@o.matrix_world@v.co for v in vertices]
   parts.append({'object':o.name,'count':len(coords),'min':[min(v[i] for v in coords) for i in range(3)],'max':[max(v[i] for v in coords) for i in range(3)],'materials':[m.name for m in o.data.materials]})
  hands.append({'name':bone.name,'head':list(bone.head_local),'tail':list(bone.tail_local),'matrix':[list(row) for row in bone.matrix_local],'parts':parts})
 rows.append({'hero':name,'armature':arm.name,'hands':hands})
(out/'inspection.json').write_text(json.dumps(rows,indent=2))
print(json.dumps(rows))
