import bpy, math, os
from pathlib import Path
root=Path(__file__).resolve().parent
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def material(name,color,metal=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=.38;return m
glass=material('Higgsfield blue glass curtain wall',(.14,.22,.29),.48)
image=bpy.data.images.load(str(root/'glass.png'));image.scale(1024,1024);image.pack()
nodes=glass.node_tree.nodes;tex=nodes.new('ShaderNodeTexImage');tex.image=image;glass.node_tree.links.new(tex.outputs['Color'],nodes.get('Principled BSDF').inputs['Base Color'])
trim=material('Aluminum floor bands',(.4,.46,.49),.7);base=material('Concrete podium',(.48,.48,.45));dark=material('Roof equipment',(.1,.13,.15))
def cylinder(name,x,y,r,h,z,mat):
 bpy.ops.mesh.primitive_cylinder_add(vertices=48,radius=r,depth=h,location=(x,y,z+h/2));o=bpy.context.object;o.name=name;o.data.materials.append(mat)
 for f in o.data.polygons:f.use_smooth=len(f.vertices)==4
 return o
# Original authored skyline study; dimensions based on published tower heights.
# The center is georeferenced in atwater.ts; satellites are architectural approximations.
for idx,(x,y,r,h) in enumerate([(0,0,28.6,221.5),(-53,-53,22,159),(53,-53,22,159),(-53,53,22,159),(53,53,22,159),(105,-56,21,103),(105,2,21,103)]):
 cylinder('RenCen tower '+str(idx),x,y,r,h,0,glass)
 for z in range(5,int(h),4):cylinder('Floor band',x,y,r+.12,.22,z,trim)
 cylinder('Crown',x,y,r+.3,2,h,trim);cylinder('Mechanical roof',x,y,r*.67,4,h+2,dark)
 bpy.ops.mesh.primitive_cube_add(size=1,location=(x,y,5));o=bpy.context.object;o.name='Tower podium';o.dimensions=(r*2.7,r*2.7,10);o.data.materials.append(base);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
# Four material batches, avoiding hundreds of draw calls for distant floor bands.
for mat in [glass,trim,base,dark]:
 bpy.ops.object.select_all(action='DESELECT');items=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.active_material==mat]
 for o in items:o.select_set(True)
 if items:bpy.context.view_layer.objects.active=items[0];bpy.ops.object.join()
bpy.ops.wm.save_as_mainfile(filepath=str(root/'Atwater_Renaissance_Center.blend'))
out=root.parent.parent/'public'/'exports'/'atwater';out.mkdir(parents=True,exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(out/'renaissance-center.glb'),export_format='GLB')
bpy.ops.export_scene.fbx(filepath=str(root/'Renaissance_Center.fbx'),apply_unit_scale=True,axis_forward='-Z',axis_up='Y',path_mode='COPY',embed_textures=True)
