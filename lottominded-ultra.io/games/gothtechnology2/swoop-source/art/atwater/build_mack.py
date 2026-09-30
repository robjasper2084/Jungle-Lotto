"""Original Gothic-futurist architecture inspired by the user's church reference.
Exterior additions preserve the existing retail/gallery interiors and doorway.
"""
import bpy, math
from pathlib import Path
root=Path(__file__).resolve().parent
out=root.parent.parent/'public'/'exports'/'atwater'
def mat(name,color,metal=0,emission=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=.48
 if emission:p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emission
 return m
def box(name,x,y,z,w,h,d,m):
 bpy.ops.mesh.primitive_cube_add(size=1,location=(x,-z,y));o=bpy.context.object;o.name=name;o.dimensions=(w,d,h);o.data.materials.append(m);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 bevel=o.modifiers.new('Stone edge highlights','BEVEL');bevel.width=.04;bevel.segments=2;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=bevel.name);return o
def rod(name,a,b,r,m):
 from mathutils import Vector
 a=Vector((a[0],-a[2],a[1]));b=Vector((b[0],-b[2],b[1]));v=b-a
 bpy.ops.mesh.primitive_cylinder_add(vertices=8,radius=r,depth=v.length,location=(a+b)/2);o=bpy.context.object;o.name=name;o.rotation_euler=v.to_track_quat('Z','Y').to_euler();o.data.materials.append(m)
for store in [False,True]:
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 stone=mat('Charcoal limestone' if store else 'Pale limestone',(.17,.19,.20) if store else (.57,.59,.56))
 metal=mat('Brushed titanium',(.18,.23,.26),.75);glow=mat('Warm amber light' if store else 'Jade light',(.95,.49,.14) if store else (.13,.77,.62),.3,2)
 glass=mat('Higgsfield curtain glass',(.10,.19,.24),.55)
 im=bpy.data.images.load(str(root/'glass.png'),check_existing=True);im.scale(1024,1024);im.pack();tex=glass.node_tree.nodes.new('ShaderNodeTexImage');tex.image=im;glass.node_tree.links.new(tex.outputs['Color'],glass.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
 # Raised clerestory, pitched roof and side buttresses. Nothing crosses the doorway.
 front=4.8 if store else 8.7
 for side in [-1,1]:
  for z in [-8,-4,0,front]:
   box('Stepped buttress',side*9.15,3.6,z,.6,7.2,.9,stone)
   box('Buttress cap',side*9.15,7.25,z,.8,.18,1.1,metal)
  box('Clerestory glazing',side*8.8,6.6,-1.5,.12,3,15,glass)
  for z in range(-8,6,2):box('Window mullion',side*8.87,6.6,z,.14,3.2,.09,metal)
  roof=box('Standing seam roof',side*4.6,9.1,-1.5,9.4,.22,18,metal);roof.rotation_euler[1]=side*math.radians(22)
 # Pointed entrance tracery above existing full-width shopfront.
 for side in [-1,1]:
  rod('Pointed arch stone',(side*8,5.2,front),(0,11.7,front),.24,stone)
  rod('Recessed illuminated arch',(side*7.65,5.2,front+.08),(0,11.2,front+.08),.035,glow)
  for x in [3.0,4.5,6.0]:rod('Lancet tracery',(side*x,5.5,front),(side*x,11.2-x*.77,front),.055,metal)
 # Four-sided square bell tower, narrow slits and four corner pinnacles.
 tx=-7.5 if store else 7.5;tz=-5
 box('Tower masonry',tx,9,tz,3.1,18,3.1,stone)
 for side in [-1,1]:
  box('Tower lancet',tx+side*1.565,14,tz,.06,4,1.35,glass)
  box('Tower vertical light',tx+side*1.6,14,tz-.65,.06,4,.035,glow)
 box('Tower cornice',tx,18,tz,3.55,.3,3.55,metal)
 for dx in [-1.4,1.4]:
  for dz in [-1.4,1.4]:
   bpy.ops.mesh.primitive_cone_add(vertices=8,radius1=.3,radius2=.015,depth=3.1,location=(tx+dx,-(tz+dz),19.7));bpy.context.object.data.materials.append(metal)
 for m in [stone,metal,glass,glow]:
  bpy.ops.object.select_all(action='DESELECT');items=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.active_material==m]
  for o in items:o.select_set(True)
  if items:bpy.context.view_layer.objects.active=items[0];bpy.ops.object.join()
 name='goth-architecture' if store else 'serengeti-architecture'
 bpy.ops.wm.save_as_mainfile(filepath=str(root/(name+'.blend')))
 bpy.ops.export_scene.gltf(filepath=str(out/(name+'.glb')),export_format='GLB')
 bpy.ops.export_scene.fbx(filepath=str(root/(name+'.fbx')),axis_forward='-Z',axis_up='Y',path_mode='COPY',embed_textures=True)
