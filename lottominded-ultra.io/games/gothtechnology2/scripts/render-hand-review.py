import bpy,sys,json
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[1]
src=root.parents[2]/'.game-builds/jazz-world-20261011/store/public/arcade/swoop-detroit/exports/glb'
out=root/'docs/combat/evidence/finger-rig';out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
name='DS_Armored_Rider_01';generated=bool(args);bpy.ops.import_scene.gltf(filepath=str(root/'swoop-source/public/exports/rigged-heroes'/ (name+'.glb') if generated else src/name/(name+'_LOD1.glb')))
arm=next(o for o in bpy.data.objects if o.type=='ARMATURE');bone=arm.data.bones['LeftHand'];frame=arm.matrix_world@bone.matrix_local
if generated:
 arm.animation_data.action=None
 for track in arm.animation_data.nla_tracks:track.mute=True
 for pb in arm.pose.bones:pb.matrix_basis.identity()
 angles=json.loads((root/'swoop-source/public/exports/rigged-heroes/manifest.json').read_text())['profiles'][args[0]]
 for pb in arm.pose.bones:
  if 'Hand' in pb.name and pb.name[-1:] in ['1','2','3']:pb.rotation_mode='XYZ';pb.rotation_euler.x=angles[int(pb.name[-1])-1]*(.65 if 'Thumb' in pb.name else 1)
 bpy.context.view_layer.update()
target=frame@Vector((0,.095,0))
bpy.ops.object.camera_add(location=frame@Vector((0,.10,.65)));cam=bpy.context.object;cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=.31;bpy.context.scene.camera=cam
for offset,power,size in [((1,-1,2),180,1.5),((-1,1,1),100,1)]:
 bpy.ops.object.light_add(type='AREA',location=target+Vector(offset));l=bpy.context.object;l.data.energy=power;l.data.shape='DISK';l.data.size=size;l.rotation_euler=(target-l.location).to_track_quat('-Z','Y').to_euler()
scene=bpy.context.scene;scene.world=bpy.data.worlds.new('HandReviewWorld');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.45,.48,.5,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.5
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.render.resolution_x=700;scene.render.resolution_y=700;scene.render.resolution_percentage=100;scene.render.filepath=str(out/('armored-hand-'+(args[0] if generated else 'before')+'.png'));bpy.ops.render.render(write_still=True)
