"""Shared Blender-authored LottoMind 2084 livery and exhaust anchors.
Run from either boat authoring script before material batching.
"""
from mathutils import Matrix
def racing_details(hydro, black, cyan, silver, tube, box):
 orange=bpy.data.materials.new('2084 red accent paint');orange.use_nodes=True
 p=orange.node_tree.nodes['Principled BSDF'];p.inputs['Base Color'].default_value=(.85,.018,.025,1);p.inputs['Metallic'].default_value=.25;p.inputs['Roughness'].default_value=.36
 badge=bpy.data.materials.new('2084 metallic decal');badge.use_nodes=True
 p=badge.node_tree.nodes['Principled BSDF'];p.inputs['Base Color'].default_value=(.69,.85,.9,1);p.inputs['Metallic'].default_value=.92;p.inputs['Roughness'].default_value=.20
 p=black.node_tree.nodes['Principled BSDF'];p.inputs['Base Color'].default_value=(.009,.014,.021,1);p.inputs['Roughness'].default_value=.45;p.inputs['Metallic'].default_value=.32
 black.name='2084 matte carbon fiber'
 p=cyan.node_tree.nodes['Principled BSDF'];p.inputs['Base Color'].default_value=(.56,.009,.018,1);p.inputs['Emission Color'].default_value=(.25,.002,.008,1);p.inputs['Emission Strength'].default_value=.035
 cyan.name='2084 crimson marine paint'
 bpy.ops.object.empty_add();branding=bpy.context.object;branding.name='LottoMind_2084_Decals'
 def text(label,loc,size,side=0):
  data=bpy.data.curves.new('2084 lettering','FONT');data.body=label;data.align_x='CENTER';data.size=size;data.extrude=.0005;data.resolution_u=2
  o=bpy.data.objects.new('Decal_'+label,data);bpy.context.collection.objects.link(o);o.location=(loc[0],-loc[2],loc[1]);o.data.materials.append(badge);o.parent=branding
  if side:
   o.rotation_euler=Matrix(((0,0,side),(side,0,0),(0,1,0))).to_euler()
  else:o.rotation_euler.z=math.pi
  bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')
 if hydro:
  text('LottoMind',(0,2.159,-3.52),.36);text('2084',(0,.485,3.35),.28)
  for side in [-1,1]:
   text('2084',(side*1.55,.616,1.25),.27)
   text('2084',(side*2.065,.28,.80),.23,side)
   tube('Orange sponson warning',[(side*1.55,.665,3.42),(side*1.55,.58,4.30)],.025,orange)
  mounts=[(-.48,.55,-3.53),(.48,.55,-3.53)]
 else:
  text('LottoMind',(0,.866,2.95),.24);text('2084',(0,.866,2.50),.32)
  for side in [-1,1]:
   text('2084',(side*1.185,.47,.20),.25,side)
   tube('Orange sheer warning',[(side*.87,.78,-2.4),(side*.99,.84,-.1),(side*.82,.88,2.15)],.018,orange)
  mounts=[(-.57,.43,-3.63),(.57,.43,-3.63)]
 # Paired fictional 2084 drive outlets: the research boat profiles stay unchanged.
 for label,loc in zip(['Jet_Port','Jet_Starboard'],mounts):
  box('2084 nozzle housing',loc,(.30,.30,.24),silver,.045)
  box('2084 nozzle throat',(loc[0],loc[1],loc[2]-.13),(.22,.22,.015),black,.035)
  bpy.ops.object.empty_add(type='PLAIN_AXES',location=(loc[0],-loc[2]+.15,loc[1]));bpy.context.object.name=label
 decals=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.parent==branding]
 bpy.ops.object.select_all(action='DESELECT')
 for o in decals:o.select_set(True)
 bpy.context.view_layer.objects.active=decals[0];bpy.ops.object.join();bpy.context.object.name='Decal_LottoMind_2084'
 return orange
