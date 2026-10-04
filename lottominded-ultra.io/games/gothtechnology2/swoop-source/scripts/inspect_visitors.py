import bpy,json
from pathlib import Path
from mathutils import Vector
out=Path(__file__).resolve().parent.parent/'art'/'visitors';out.mkdir(parents=True,exist_ok=True)
for id in ['DS_Hoodie_Man_01','DS_Hoodie_Woman_01']:
 bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.ops.import_scene.gltf(filepath=str(Path(r'C:\Users\digit\Documents\phone\Digital_Static_Street_Asset_Pack\exports\glb')/id/(id+'_LOD1.glb')))
 arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
 mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH')
 hi=mesh.vertex_groups.find('Head');hv=[v.co for v in mesh.data.vertices if any(g.group==hi and g.weight>.5 for g in v.groups)]
 print('HEAD_BOUNDS',id,[min(v[k] for v in hv) for k in range(3)],[max(v[k] for v in hv) for k in range(3)])
 for z in [1.5,1.55,1.6,1.65,1.7,1.75]:
  vv=[v for v in hv if abs(v.z-z)<.02 and abs(v.x)<.09];print('HEAD_SLICE',z,len(vv),[min(v.y for v in vv),max(v.y for v in vv)] if vv else [])
 print(id,json.dumps({'matrix':list(map(list,mesh.matrix_world)), 'groups':[g.name for g in mesh.vertex_groups],'bones':{b.name:{'head':list(b.head_local),'tail':list(b.tail_local),'matrix':list(map(list,b.matrix_local))} for b in arm.data.bones if b.name in ['Hips','Head','neck','LeftHand','RightHand','Spine','Spine02']}}))
 for img in bpy.data.images:
  if img.type=='IMAGE' and img.size[0]>64:
   img.filepath_raw=str(out/(id+'-source-texture.png'));img.file_format='PNG';img.save()
