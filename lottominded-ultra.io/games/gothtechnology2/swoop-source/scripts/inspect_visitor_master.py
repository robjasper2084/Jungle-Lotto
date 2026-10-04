import bpy,json
from pathlib import Path
root=Path(__file__).resolve().parent.parent
bpy.ops.wm.open_mainfile(filepath=str(root/'art/visitors/GothTech_Reference_Visitors.blend'))
for o in bpy.context.scene.objects:
 if o.type=='MESH' and o.name.endswith('_Body'):
  print('VISITOR_BODY',o.name,json.dumps({'data':o.data.name,'parent':o.parent.name if o.parent else None,'modifiers':[(m.name,m.type,getattr(m,'object',None).name if getattr(m,'object',None) else None) for m in o.modifiers],'materials':[m.name for m in o.data.materials], 'counts':{m.name:sum(1 for p in o.data.polygons if p.material_index==i) for i,m in enumerate(o.data.materials)},'faceLow':min(v.co.z for v in o.data.vertices)}))
for image in bpy.data.images:
 if 'supplied face projection' in image.name:
  image.filepath_raw=str(root/'art/visitors'/(image.name.replace(' ','-')+'.png'));image.file_format='PNG';image.save()
