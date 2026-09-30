"""Retain existing rigs and survey-aligned placement; author petals and a folded-leg sit."""
import bpy,math,json,random
from pathlib import Path
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parents[1];PUB=ROOT/'public/elmwood'
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'art/blender/DS_Boerboel_Elmwood_Commands.blend'))
bpy.context.preferences.filepaths.save_version=0
arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');arm.animation_data.action=None
for track in list(arm.animation_data.nla_tracks):
 if track.name=='Dog_Sit':arm.animation_data.nla_tracks.remove(track)
 else:track.mute=True
for bone in arm.pose.bones:bone.matrix_basis=Matrix.Identity(4)
bpy.context.view_layer.update();rests={p.name:p.matrix.copy() for p in arm.pose.bones};feet={n:arm.pose.bones[n].head.copy() for n in rests if '_paw_' in n}
source=(ROOT/'tools/build_dog_companion.py').read_text(encoding='utf-8');exec(source[source.index('def update():'):source.index('scene=bpy.context.scene;')])
action=bpy.data.actions.new('Dog_Sit_Grounded');arm.animation_data.action=action
for frame in range(1,122):
 for bone in arm.pose.bones:bone.matrix_basis=Matrix.Identity(4)
 update();pivot=rests['pelvis'].translation.copy()
 arm.pose.bones['pelvis'].matrix=Matrix.Translation(pivot+Vector((0,.025,-.39)))@Matrix.Rotation(-.82,4,'X')@Matrix.Translation(-pivot)@rests['pelvis'];update()
 chest=arm.pose.bones['chest'];m=chest.matrix.copy();m.translation.z-=.050;chest.matrix=m;update()
 for name,angle in [('neck',.25),('head',.42)]:
  bone=arm.pose.bones[name];p=bone.head.copy();bone.matrix=Matrix.Translation(p)@Matrix.Rotation(angle,4,'X')@Matrix.Translation(-p)@bone.matrix;update()
 for side in ['L','R']:
  solve('front',side,feet['front_paw_'+side]+Vector((0,.18,0)))
  sign=-1 if side=='L' else 1
  # Fold at the existing anatomical hip joint; never translate the leg root.
  solve('hind',side,Vector((sign*.16,.08,.17)),Vector((0,-1,.35)))
 arm.pose.bones['chest'].scale=(1+math.sin((frame-1)/120*math.tau)*.002,1,1+math.sin((frame-1)/120*math.tau)*.003)
 for bone in arm.pose.bones:
  bone.keyframe_insert('location',frame=frame);bone.keyframe_insert('rotation_quaternion',frame=frame);bone.keyframe_insert('scale',frame=frame)
track=arm.animation_data.nla_tracks.new();track.name='Dog_Sit';track.strips.new('Dog_Sit',1,action);arm.animation_data.action=None
for obj in [o for o in bpy.context.scene.objects if o.type=='MESH']:
 if obj.data.shape_keys and 'SitCorrective' in obj.data.shape_keys.key_blocks:obj.shape_key_remove(obj.data.shape_keys.key_blocks['SitCorrective'])
for track in arm.animation_data.nla_tracks:track.mute=False
bpy.context.scene.frame_start=1;bpy.context.scene.frame_end=121;bpy.context.scene.frame_set(1)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/exports/glb/DS_Boerboel_01/DS_Boerboel_Elmwood.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_frame_range=True,export_anim_slide_to_zero=True)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/blender/DS_Boerboel_Elmwood_Commands.blend'))



