import bpy,json
from pathlib import Path
from mathutils import Vector
p=Path('C:/Users/digit/Documents/phone/Digital_Static_Street_Asset_Pack')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(p/'exports/glb/DS_Cyclist_01/DS_Cyclist_01_LOD1.glb'))
for o in bpy.context.scene.objects:
 if o.type=='ARMATURE':
  o.animation_data_clear()
  for b in o.pose.bones:b.matrix_basis.identity()
  print('BONES',json.dumps({b.name:list(o.matrix_world@b.head_local) for b in o.data.bones}))
bpy.context.view_layer.update()
print('MESHES',[(o.name,len(o.data.vertices)) for o in bpy.context.scene.objects if o.type=='MESH'])
world=bpy.data.worlds.new('Studio');bpy.context.scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.28,.28,.28,1)
for loc,power in [((3,-4,5),650),((-3,-2,3),450)]:
 bpy.ops.object.light_add(type='AREA',location=loc);l=bpy.context.object;l.data.energy=power;l.data.shape='DISK';l.data.size=4;l.rotation_euler=(Vector((0,0,1))-l.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(2,-5,2));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,.9))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=2.3;bpy.context.scene.camera=cam
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=12;s.render.resolution_x=650;s.render.resolution_y=800;s.render.resolution_percentage=100;s.render.filepath=str(Path(__file__).parents[1]/'art/scooter-base.png');bpy.ops.render.render(write_still=True)
