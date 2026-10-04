"""Render the actual independent vintage cabinet Blender masters for review."""
import bpy, math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent.parent;ART=ROOT/'art/studio-retail'
bpy.ops.wm.read_factory_settings(use_empty=True)
for x,name in [(-1.25,'Arcade_2084_Static_Wave'),(0,'Arcade_Robot_Rahbe'),(1.25,'Arcade_Underground')]:
 with bpy.data.libraries.load(str(ART/(name+'.blend')),link=False) as (source,destination):destination.objects=source.objects
 for o in destination.objects:
  if o: bpy.context.collection.objects.link(o);o.location.x+=x
bpy.ops.mesh.primitive_plane_add(size=200);ground=bpy.context.object;ground.location.z=-.012
mat=bpy.data.materials.new('Preview charcoal');mat.diffuse_color=(.07,.09,.1,1);ground.data.materials.append(mat)
bpy.ops.object.camera_add(location=(4.7,-7.4,3.5));camera=bpy.context.object;camera.rotation_euler=(Vector((0,0,1.0))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.lens=58;bpy.context.scene.camera=camera
for location,power,size in [((1,-3.5,5),1300,5),((-4,-1,3),900,4),((2,3,5),1400,3)]:
 bpy.ops.object.light_add(type='AREA',location=location);light=bpy.context.object;light.data.energy=power;light.data.shape='DISK';light.data.size=size;light.rotation_euler=(Vector((0,0,1))-light.location).to_track_quat('-Z','Y').to_euler()
scene=bpy.context.scene;scene.world=bpy.data.worlds.new('Cabinet preview world');scene.world.color=(.12,.12,.12);scene.render.engine='CYCLES';scene.cycles.samples=32;scene.render.resolution_x=1600;scene.render.resolution_y=1100;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX';scene.render.filepath=str(ART/'Arcade_Cabinet_Blender_Preview.png');bpy.ops.render.render(write_still=True)
