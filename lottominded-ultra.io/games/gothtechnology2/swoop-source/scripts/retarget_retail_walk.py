"""Bake installed Human Basic Motions walk onto the original Swoop hero.
The source FBX stays in the licensed Unity project. Only this hero's baked clip
is embedded in the game. Blender keeps an editable, fully keyed master.
"""
import bpy, math, json
from pathlib import Path
from mathutils import Vector, Matrix
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'art'/'animation-polish';OUT.mkdir(parents=True,exist_ok=True)
hero=Path(r'C:\Users\digit\Documents\phone\Digital_Static_Street_Asset_Pack\exports\glb\DS_Man_01\DS_Man_01_LOD0.glb')
walk=Path(r'C:\Users\digit\Documents\phone\euc-detroit-riverwalk\art\elmwood\landmark-pass\Unity\Assets\Kevin Iglesias\Human Animations\Animations\Male\Movement\Walk\HumanM@Walk01_Forward.fbx')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(hero))
target=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
target_objects=list(bpy.context.scene.objects);target.animation_data_clear()
bpy.ops.import_scene.fbx(filepath=str(walk),ignore_leaf_bones=True)
source=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE' and o!=target)
source_objects=[o for o in bpy.context.scene.objects if o not in target_objects]
scene=bpy.context.scene;scene.frame_set(1)
root_rest=source.data.bones['B-root'].matrix_local
calibration=source.matrix_world@source.pose.bones['B-root'].matrix@root_rest.inverted()
mapping={'Hips':'B-hips','Spine02':'B-spine','Spine01':'B-chest','Spine':'B-chest','neck':'B-neck','Head':'B-head'}
for side,letter in [('Left','L'),('Right','R')]:
 for t,s in [('Shoulder','shoulder'),('Arm','upperArm'),('ForeArm','forearm'),('Hand','hand'),('UpLeg','thigh'),('Leg','shin'),('Foot','foot')]:mapping[side+t]='B-'+s+'.'+letter
offsets={}
for t,s in mapping.items():
 tb=target.data.bones[t];sb=source.data.bones[s]
 sr=calibration@sb.matrix_local
 sd=(calibration.to_3x3()@(sb.tail_local-sb.head_local)).normalized()
 td=(tb.tail_local-tb.head_local).normalized()
 # Match anatomical segment directions as well as the differing rest-pose rolls.
 align=td.rotation_difference(sd)
 offsets[t]=sr.to_quaternion().inverted()@align@tb.matrix_local.to_quaternion()
samples=[]
for frame in range(1,22):
 scene.frame_set(frame)
 desired={t:(source.matrix_world@source.pose.bones[s].matrix).to_quaternion()@offsets[t] for t,s in mapping.items()}
 hip=(source.matrix_world@source.pose.bones['B-hips'].matrix).translation*.01
 samples.append({'frame':frame,'hip':list(hip),'desired':{t:list(q) for t,q in desired.items()}})
mean_hip=sum((Vector(s['hip']) for s in samples[:-1]),Vector())/20
target.animation_data_create();action=bpy.data.actions.new('GothTech_Hero_HumanBasicMotions_Walk');target.animation_data.action=action
for sample in samples:
 frame=sample['frame'];scene.frame_set(frame)
 for pb in target.pose.bones:pb.rotation_mode='QUATERNION';pb.matrix_basis=Matrix.Identity(4)
 for pb in target.pose.bones:
  if pb.name not in mapping:continue
  current=desired={t:__import__('mathutils').Quaternion(q) for t,q in sample['desired'].items()}
  parent_rotation=current.get(pb.parent.name,pb.parent.matrix.to_quaternion()) if pb.parent else __import__('mathutils').Quaternion()
  local_rest=pb.parent.bone.matrix_local.inverted()@pb.bone.matrix_local if pb.parent else pb.bone.matrix_local
  pb.rotation_quaternion=local_rest.to_quaternion().inverted()@parent_rotation.inverted()@current[pb.name]
  if pb.name=='Hips':
   delta=Vector(sample['hip'])-mean_hip;delta.y=0
   pb.location=pb.bone.matrix_local.to_3x3().inverted()@delta
   pb.keyframe_insert(data_path='location',frame=frame,group=pb.name)
  pb.keyframe_insert(data_path='rotation_quaternion',frame=frame,group=pb.name)
  bpy.context.view_layer.update()
for o in source_objects:bpy.data.objects.remove(o,do_unlink=True)
scene.render.fps=24;scene.frame_start=1;scene.frame_end=21;scene.frame_set(1)
target['animation_source']='Installed Kevin Iglesias Human Basic Motions 2.4 FREE / Male Walk01 Forward'
target['retarget']='World segment alignment, bind-roll correction and in-place pelvis; 24 fps loop'
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'GothTech_Hero_Retail_Walk.blend'))
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(OUT/'gothtech-hero-walk-authoring.glb'),export_format='GLB',export_yup=True,export_animations=True,export_animation_mode='ACTIVE_ACTIONS',export_force_sampling=True,export_frame_range=True,export_anim_slide_to_zero=True)
report={'source':str(walk),'hero':str(hero),'frames':21,'fps':24,'duration':20/24,'mappedBones':list(mapping),'sourcePelvisMetres':[list(mean_hip),samples[0]['hip']],'master':'GothTech_Hero_Retail_Walk.blend'}
(OUT/'retail-walk-retarget.json').write_text(json.dumps(report,indent=2));print('RETAIL_WALK_BAKED',json.dumps(report))
