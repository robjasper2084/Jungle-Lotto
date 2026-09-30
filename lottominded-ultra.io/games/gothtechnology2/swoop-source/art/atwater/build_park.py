"""Original Milliken reference assets. Metres; DNR lighthouse height 63 feet."""
import bpy, math
from pathlib import Path
root=Path(__file__).resolve().parent
out=root.parent.parent/'public/exports/atwater'
def material(name,color,metal=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=.65
 return m
def box(name,loc,size,mat):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=size;o.data.materials.append(mat);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return o
def cone(name,z,r1,r2,h,mat,verts=48,x=0,y=0):
 bpy.ops.mesh.primitive_cone_add(vertices=verts,radius1=r1,radius2=r2,depth=h,location=(x,y,z));o=bpy.context.object;o.name=name;o.data.materials.append(mat);return o
def save(name):
 for mat in list(bpy.data.materials):
  items=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.active_material==mat]
  bpy.ops.object.select_all(action='DESELECT')
  for o in items:o.select_set(True)
  if items:bpy.context.view_layer.objects.active=items[0];bpy.ops.object.join()
 bpy.ops.wm.save_as_mainfile(filepath=str(root/(name+'.blend')))
 bpy.ops.export_scene.gltf(filepath=str(out/(name+'.glb')),export_format='GLB')
 bpy.ops.export_scene.fbx(filepath=str(root/(name+'.fbx')),axis_forward='-Z',axis_up='Y',path_mode='COPY',embed_textures=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
white=material('Higgsfield painted lighthouse masonry',(.88,.87,.81));dark=material('Black painted iron',(.035,.045,.044),.55);red=material('Weathered red lantern roof',(.36,.07,.045),.2);glass=material('Lantern glazing',(.20,.32,.34),.5)
im=bpy.data.images.load(str(root/'lighthouse-brick.png'));im.scale(1024,1024);im.pack();tex=white.node_tree.nodes.new('ShaderNodeTexImage');tex.image=im;white.node_tree.links.new(tex.outputs['Color'],white.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
cone('Stone plinth',.25,3,3,.5,white)
cone('Tapered white tower',8.05,2.55,1.65,15.6,white)
cone('Gallery cornice',15.9,2.35,2.35,.35,white)
cone('Octagonal lantern',17,1.62,1.62,1.8,glass,8)
for i in range(8):
 a=i*math.tau/8
 cone('Lantern mullion',17,.055,.055,1.85,dark,8,1.62*math.cos(a),1.62*math.sin(a))
for i in range(24):
 a=i*math.tau/24
 cone('Gallery railing upright',16.6,.028,.028,1.1,dark,6,2.2*math.cos(a),2.2*math.sin(a))
for z in [16.15,17.1]:
 bpy.ops.mesh.primitive_torus_add(major_radius=2.2,minor_radius=.035,major_segments=48,minor_segments=6,location=(0,0,z));bpy.context.object.data.materials.append(dark)
cone('Red lantern cap',18.48,1.96,.12,1.16,red,8)
cone('Finial',19.1,.08,.015,.205,dark,8)
box('Entry door',(0,-2.5,1.3),(1.05,.08,2.1),dark)
for z in [5,9,12.5]:box('Tower window',(0,-(2.55-z*.056),z),(.45,.09,.9),dark)
save('milliken-lighthouse')
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
steel=material('Viewer silver casting',(.48,.53,.52),.7)
cone('Viewer base',.08,.28,.28,.16,dark,16);cone('Viewer pedestal',.64,.075,.075,1.15,dark,12)
box('Binocular body',(0,0,1.28),(.48,.35,.20),steel)
for x in [-.13,.13]:
 o=cone('Eyepiece',1.3,.075,.075,.25,dark,12,x,-.2);o.rotation_euler.x=math.pi/2
save('milliken-viewer')
