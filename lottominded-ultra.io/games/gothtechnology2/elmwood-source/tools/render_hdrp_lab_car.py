import bpy, math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];ART=ROOT/'art/elmwood/hdrp-lab-car'
bpy.ops.wm.open_mainfile(filepath=str(ART/'hdrp-lab-car-black.blend'))
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24
scene.render.resolution_x=1000;scene.render.resolution_y=680;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Studio world');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.24,.29,.36,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.65
bpy.ops.mesh.primitive_plane_add(size=200);floor=bpy.context.object;floor.location.z=-.012
m=bpy.data.materials.new('Preview floor');m.diffuse_color=(.18,.2,.22,1);floor.data.materials.append(m)
for pos,energy,size in [((3,1,7),1900,6),((-4,-2,4),1100,5),((1,-5,5),1400,4)]:
 bpy.ops.object.light_add(type='AREA',location=pos);o=bpy.context.object;o.data.energy=energy;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,.5))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(6.2,7.4,3.8));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,.65))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.lens=52;scene.camera=cam
scene.render.filepath=str(ART/'black-car-preview.png');bpy.ops.render.render(write_still=True)
