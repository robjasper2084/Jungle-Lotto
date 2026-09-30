import bpy
from pathlib import Path
p=Path(__file__).resolve().parents[1];bpy.ops.wm.open_mainfile(filepath=str(p/'art/blender/DS_Boerboel_Elmwood_Commands.blend'))
a=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
for o in [o for o in bpy.context.scene.objects if o.type=='MESH' and len(o.vertex_groups)>0]:
 for v in o.data.vertices:
  x,y,z=a.matrix_world.inverted()@o.matrix_world@v.co
  prefix='hind' if y>.17 else 'front' if y<-.12 else None
  if not prefix:continue
  high=.26 if prefix=='hind' else .18;low=.19 if prefix=='hind' else .10
  blend=max(0,min(1,(high-z)/(high-low)))
  if not blend:continue
  old={o.vertex_groups[g.group].name:g.weight for g in v.groups};paw=prefix+'_paw_'+('L' if x<0 else 'R')
  for n,w in old.items():o.vertex_groups[n].add([v.index],w*(1-blend),'REPLACE')
  o.vertex_groups[paw].add([v.index],old.get(paw,0)*(1-blend)+blend,'REPLACE')
bpy.ops.wm.save_as_mainfile(filepath=str(p/'art/blender/DS_Boerboel_Elmwood_Commands.blend'))
